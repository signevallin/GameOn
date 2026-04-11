# Power-ups Feature Design

**Date:** 2026-04-11  
**Status:** Approved  
**Stack:** Next.js 14 App Router, Supabase (PostgreSQL), polling every 3s (teams) / 5s (admin)

---

## Overview

Admin panel gets a Power-ups card with three one-time-use abilities per game:

| Power-up | Effect | Team notification |
|----------|--------|-------------------|
| 🧨 Sabotage | Deduct 10 points from a team | Yes — "💥 SABOTAGE! -10 points deducted from your team" |
| 🎯 Double points | Next mission completed by a team scores ×2 | Yes — "🎉 POWER-UP! Double points on your next mission!" |
| 🔍 Fake hint | Admin writes custom text shown to a team | Yes — "🔍 SECRET TIP" + admin-written message |

Each power-up is a **one-time use per game** (cannot be reused once activated).

---

## Data Model

### New columns on `teams` table

```sql
ALTER TABLE teams
  ADD COLUMN pending_notification jsonb DEFAULT NULL,
  ADD COLUMN double_points boolean DEFAULT false;
```

`pending_notification` shape:
```json
{ "type": "sabotage" | "double_points" | "fake_hint", "message": "string" }
```

Set to `NULL` once the team acknowledges the notification.

### New column on `settings` table (game-level tracking)

```sql
ALTER TABLE settings
  ADD COLUMN powerups_used text[] DEFAULT '{}';
```

Key format: `"<type>_<teamId>"` — e.g. `"sabotage_team-uuid-123"`.  
This persists which power-ups have been used even if admin refreshes the page.

---

## API Routes

### `POST /api/admin/powerup`

Admin activates a power-up. Request body:
```json
{
  "type": "sabotage" | "double_points" | "fake_hint",
  "targetTeamId": "uuid",
  "message": "optional string (required for fake_hint)"
}
```

Logic:
1. Check `settings.powerups_used` — reject if `"<type>_<targetTeamId>"` already present.
2. Apply effect:
   - **sabotage**: `UPDATE teams SET score = GREATEST(0, score - 10), pending_notification = '{"type":"sabotage","message":"💥 SABOTAGE! -10 points deducted from your team"}' WHERE id = targetTeamId`
   - **double_points**: `UPDATE teams SET double_points = true, pending_notification = '{"type":"double_points","message":"🎉 POWER-UP! Double points on your next mission!"}' WHERE id = targetTeamId`
   - **fake_hint**: `UPDATE teams SET pending_notification = '{"type":"fake_hint","message":"<admin text>"}' WHERE id = targetTeamId`
3. Append key to `settings.powerups_used`.
4. Return updated settings + team.

### `POST /api/team/ack-notification`

Team calls this after displaying the notification. Request body:
```json
{ "teamId": "uuid" }
```

Sets `pending_notification = NULL` for the team. Returns `{ ok: true }`.

### Updated `POST /api/team/score`

After computing `pts`, if `team.double_points = true`:
- Multiply `pts × 2`
- Set `double_points = false` on the team in the same update

---

## Admin UX

New card in `AdminScreen.tsx`, rendered below existing cards:

```
┌─────────────────────────────────────────┐
│  ⚡ POWER-UPS                            │
│                                          │
│  🧨 Sabotage a team     [Select team ▼] │
│                          [ACTIVATE]      │
│  ✓ Used on: Team Alpha  (if used)       │
│                                          │
│  🎯 Double points       [Select team ▼] │
│                          [ACTIVATE]      │
│                                          │
│  🔍 Fake hint           [Select team ▼] │
│  [Type your message...]                  │
│                          [SEND]          │
└─────────────────────────────────────────┘
```

- Dropdowns list all active teams from existing game state (already available in AdminScreen).
- Once a power-up is used: button becomes disabled, shows "✓ Used on: [team name]".
- `powerups_used` is loaded from `settings` on each admin poll so state survives page refresh.

---

## Team UX

Teams poll `/api/game` every 3 seconds. The polling response already includes team data. When `team.pending_notification !== null`, `MissionsScreen` (or a wrapper) renders a full-screen overlay modal:

**Sabotage:**
```
┌───────────────────────────────────┐
│  💥 SABOTAGE!                      │
│  -10 points deducted from your team│
│            [OK]                    │
└───────────────────────────────────┘
```

**Double points:**
```
┌───────────────────────────────────┐
│  🎉 POWER-UP!                      │
│  Double points on your next mission│
│            [LET'S GO!]             │
└───────────────────────────────────┘
```

**Fake hint:**
```
┌───────────────────────────────────┐
│  🔍 SECRET TIP                     │
│  [admin-written message]           │
│            [OK]                    │
└───────────────────────────────────┘
```

On OK/button press: call `POST /api/team/ack-notification` → clears `pending_notification` → modal dismisses.

---

## Component Changes

| File | Change |
|------|--------|
| `components/screens/AdminScreen.tsx` | Add `PowerUpsCard` component (can be inline or separate file) |
| `components/screens/MissionsScreen.tsx` | Check `team.pending_notification`, render `NotificationOverlay` |
| `app/api/admin/powerup/route.ts` | New route |
| `app/api/team/ack-notification/route.ts` | New route |
| `app/api/team/score/route.ts` | Handle `double_points` multiplier + reset |
| Supabase migration | Add `pending_notification`, `double_points` to `teams`; `powerups_used` to `settings` |

---

## Edge Cases

- **Score can't go below 0** on sabotage: use `GREATEST(0, score - 10)`.
- **Double points + mission already completed**: the existing `team.completed?.includes(missionId)` check in `ChallengeScreen` returns 0 pts — double of 0 is still 0, no special handling needed.
- **Admin refreshes mid-game**: `powerups_used` is persisted in `settings`, so disabled state is correctly restored.
- **Team is on a mission when notification arrives**: overlay shows on top of `MissionsScreen` — the team is not in `MissionsScreen` during a challenge, so we must also check `pending_notification` in `ChallengeScreen` and show overlay there too (or only on MissionsScreen and they see it when they return).

> **Decision on last edge case:** Show notification only on `MissionsScreen` (when team returns from a mission). Simpler, and sabotage/double-points still applies correctly since score/flag is already updated in DB.
