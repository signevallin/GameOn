# AR Mystery Box Design

## Goal

Let admins drop a virtual mystery box mid-game using their phone's AR camera. All teams race to open it first — the winner gets a random power-up as a bonus charge, bypassing the normal "already used" restriction.

---

## User Flows

### Admin flow

1. Admin taps **🎁 AR Mystery Box** button in the game dashboard (visible while game status is `active`).
2. The AR camera opens (WebXR hit-test mode). A 3D box appears anchored to the first detected horizontal surface.
3. Admin positions the box by moving the phone, then taps **"Placera här"** to confirm.
4. The server creates the mystery box record on the game and broadcasts a `mystery_box` notification to all teams.
5. A 2-minute countdown starts on both admin and team screens.
6. If no team claims it within 2 minutes the box expires automatically.

### Team flow

1. Team sees a full-screen banner: **"📦 Mystery Box appeared! Race to open it!"** with a live countdown.
2. Team taps the banner → AR camera opens.
3. WebXR places the box on the first detected surface in front of the team.
4. Team taps the box → claim request sent to server.
5. **First team to claim wins:** a random power-up is assigned (server-side) and stored in `extra_powerups`.
6. Winning team sees the power-up reveal animation.
7. All other teams see: *"[Team X] grabbed the mystery box! 💨"*

### Expiry

If `now() > expires_at` and `claimed_by` is null:
- `mystery_box` is set to `null` on the game.
- All teams receive a `mystery_box_expired` notification.

---

## Architecture

### Database changes

**`games` table — new column `mystery_box`**

```sql
ALTER TABLE games ADD COLUMN mystery_box jsonb DEFAULT NULL;
```

Shape (when active):
```json
{
  "created_at": "2026-06-08T10:00:00Z",
  "expires_at": "2026-06-08T10:02:00Z",
  "claimed_by": null
}
```

`claimed_by` is set to the winning team's `id` when claimed. The column returns to `null` after expiry (handled by the claim/expiry endpoints).

**`teams` table — new column `extra_powerups`**

```sql
ALTER TABLE teams ADD COLUMN extra_powerups text[] NOT NULL DEFAULT '{}';
```

Stores extra charges earned from mystery boxes. Each entry is a power-up type string (e.g. `"freeze"`). When the team uses the power-up, one entry is removed from `extra_powerups`. The `team_powerups_used` check is skipped if the power-up exists in `extra_powerups`.

---

### New API routes

#### `POST /api/admin/mystery-box`

Auth: admin token required, game must be `active`.

- Checks no mystery box is currently active on the game (409 if one exists).
- Inserts `mystery_box = { created_at, expires_at: now + 2 min, claimed_by: null }` on the game.
- Fetches all teams for the game and sets `pending_notification = { type: 'mystery_box', msgKey: 'mystery_box_msg', params: {} }` on each.
- Returns `{ ok: true, expiresAt }`.

#### `POST /api/team/mystery-box/claim`

Body: `{ teamId: string }`

- Loads the game via `team.game_id`.
- Checks `mystery_box` is not null and `expires_at > now()` and `claimed_by` is null. Returns 409 if already claimed or expired.
- Picks a random power-up from the pool: `['shield', 'freeze', 'double_trouble', 'all_in', 'point_steal', 'robin_hood']`.
- Updates `games.mystery_box.claimed_by = teamId`.
- Appends the power-up to `teams.extra_powerups` for the winning team.
- Sets `pending_notification = { type: 'mystery_box_won', msgKey: 'mystery_box_won_msg', params: { powerup } }` on winning team.
- Broadcasts `pending_notification = { type: 'mystery_box_taken', msgKey: 'mystery_box_taken_msg', params: { team: winnerName } }` to all other teams.
- Returns `{ ok: true, powerup }`.

---

### Modified: `app/api/team/powerup/route.ts`

When processing a power-up use:

```typescript
const usedPowerups: string[] = sender.team_powerups_used ?? [];
const extraPowerups: string[] = sender.extra_powerups ?? [];

const hasExtra = extraPowerups.includes(type);
if (usedPowerups.includes(type) && !hasExtra) {
  return NextResponse.json({ error: 'You have already used this power-up.' }, { status: 409 });
}

// After successful execution:
if (hasExtra) {
  // Remove one charge from extra_powerups
  const idx = extraPowerups.indexOf(type);
  const newExtra = [...extraPowerups.slice(0, idx), ...extraPowerups.slice(idx + 1)];
  await supabase.from('teams').update({ extra_powerups: newExtra }).eq('id', senderTeamId);
} else {
  await supabase.from('teams').update({
    team_powerups_used: [...usedPowerups, type],
  }).eq('id', senderTeamId);
}
```

---

### Admin UI — AdminScreen.tsx

New button in the game dashboard (alongside existing power-up controls):

```
[🎁 AR Mystery Box]
```

- Visible only when `game.status === 'active'` and no mystery box is currently active.
- While a box is active: shows a countdown timer and **"Mystery Box active — 1:42 remaining"**.
- On click: opens the AR placement view (full-screen overlay).

**AR placement overlay:**
- Opens WebXR session (`immersive-ar`, `hit-test` feature).
- Renders a 3D box model (CSS 3D or Three.js minimal) anchored to the detected hit-test surface.
- "Placera här" confirm button.
- Fallback if WebXR not supported: shows an error message — "Your device does not support AR. Try on a modern Android or iOS device."

---

### Team UI — MissionsScreen.tsx (or page.tsx notification handler)

When `pending_notification.type === 'mystery_box'`:

- Show a full-screen gold banner with countdown (2 min, counts down client-side from `notification receipt time`).
- **"Öppna AR-kameran"** button → opens the AR claim view.

**AR claim view:**
- Opens WebXR (`immersive-ar`, `hit-test`).
- Places the mystery box on the first detected surface.
- Tap on box → POST `/api/team/mystery-box/claim`.
- On success: box explodes open, power-up icon spins up, confetti.
- On 409 (taken): "Too late! [Team X] got it 💨"
- On 409 (expired): "The box disappeared… ⏰"
- Fallback if WebXR not supported: show the box as a fullscreen 2D animation instead; tap anywhere to claim.

---

## Power-up pool

Random selection server-side from:
`shield`, `freeze`, `double_trouble`, `all_in`, `point_steal`, `robin_hood`

Each type has equal probability (1/6).

---

## WebXR implementation notes

- Feature detection: `navigator.xr?.isSessionSupported('immersive-ar')`.
- Hit test: `XRSession.requestHitTestSource()` with viewer reference space.
- Surface reticle: a small circle that tracks the hit-test result each frame, indicating where the box will land.
- Box placement: on confirm (or on claim tap), the box snaps to the last valid hit-test pose.
- Rendering: CSS 3D transform for the box model (no Three.js dependency needed for a simple cube).

---

## Notification keys (i18n)

| Key | Text |
|-----|------|
| `mystery_box_msg` | "📦 A mystery box appeared! Race to open it!" |
| `mystery_box_won_msg` | "🎉 You got the mystery box! +1 {powerup}" |
| `mystery_box_taken_msg` | "{team} grabbed the mystery box! 💨" |
| `mystery_box_expired_msg` | "The mystery box disappeared… no one was fast enough ⏰" |

---

## Error states

| Scenario | Behaviour |
|---|---|
| Second admin tries to create box while one is active | 409 — "A mystery box is already active" |
| Team claims after 2 min | 409 — box expired message |
| Two teams claim simultaneously | First request wins (DB update with `claimed_by IS NULL` check), second gets 409 |
| WebXR not supported | Fallback: fullscreen 2D box, tap anywhere to claim |
| Admin's device has no WebXR | Error message in placement overlay |

---

## Out of scope

- Multiple mystery boxes active at once
- Admin choosing which power-up is inside
- Persistent AR anchors shared between devices
- Mystery box history / log
