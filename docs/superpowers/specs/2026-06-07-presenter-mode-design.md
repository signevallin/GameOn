# Presenter Mode Design

## Goal

A full-screen display page for projectors and TVs, opened from the admin dashboard, showing a live leaderboard, photo grid, countdown timer, and dramatic full-screen overlays for power-up events.

## Architecture

### New page: `app/present/[gameKey]/page.tsx`
- Client component, no auth required
- Opened via `window.open('/present/' + activeGame.game_key, '_blank')` from a "📺 Presenter" button in the admin dashboard
- Polls `/api/present/[gameKey]` every 4 seconds
- Designed for 16:9 screens (projectors, TVs) — full viewport height, no scrolling

### New public API: `app/api/present/[gameKey]/route.ts`
- `GET` — no authentication required (read-only, public game data)
- Returns:
  - `game`: `{ name, status, started_at, duration_minutes }`
  - `teams`: `[{ id, name, score, pending_notification }]` sorted by score descending
  - `photos`: approved photos only, sorted newest first, max 20

### Admin dashboard change: `components/screens/AdminScreen.tsx`
- Add "📺 Presenter" button to the game dashboard toolbar (visible when game is active or finished)
- Opens `/present/[activeGame.game_key]` in a new tab

---

## Layout

```
┌──────────────────────────────────────────────────────┐
│  GameOn logo  |  Game Name  |  ⏱ 23:45 kvar         │  ← top bar
├────────────────────┬─────────────────────────────────┤
│                    │                                  │
│   Leaderboard      │   Photo grid                    │
│   ~30% width       │   ~70% width                    │
│                    │                                  │
│  🥇 Alpha  1840 p  │  [photo] [photo] [photo] [photo]│
│  🥈 Wolves 1620 p  │  [photo] [photo] [photo] [photo]│
│  🥉 C+W    1490 p  │  [photo] [photo]                │
│  4. NoIdea 1230 p  │                                  │
│  5. Heroes  980 p  │                                  │
│                    │                                  │
└────────────────────┴─────────────────────────────────┘
```

### Top bar
- GameOn logo (left)
- Game name (center)
- Countdown timer `⏱ MM:SS kvar` (right) — computed from `started_at + duration_minutes`; shows "Avslutat" when game is finished or timer hits 0

### Leaderboard (~30% width)
- All teams, ranked by score descending
- Each row: rank medal/number + team name + score in points
- Top 3 use 🥇🥈🥉, rest show position number
- Updates on every poll

### Photo grid (~70% width)
- Approved photos only, newest first, max 20 shown
- Responsive grid: fills available space
- Photos shown as square thumbnails with object-fit cover
- Updates on every poll (new approved photos appear automatically)

---

## Power-up Overlays

When any team's `pending_notification` changes between polls, a full-screen overlay appears for 4 seconds then auto-dismisses.

The presenter page tracks the last seen `pending_notification` per team. On each poll, it diffs the new data against the previous — any team with a changed `pending_notification` triggers an overlay.

### Overlay content per notification type

| msgKey | Display |
|--------|---------|
| `frozen_msg` | ❄️ **FRYST!** `[team]` frös `[target]` |
| `double_trouble_msg` | 😈 **DOUBLE TROUBLE!** `[target]` måste slutföra extrauppdrag |
| `shield_msg` | 🛡️ **SKÖLD AKTIVERAD!** `[team]` skyddade sig |
| `all_in_lost_msg` | 🎲 **GAMBLADE BORT!** `[team]` förlorade poäng |
| `all_in_won_msg` | 🎲 **JACKPOT!** `[team]` vann poäng |
| `point_steal_from_msg` | 🤑 **POÄNGTJUV!** `[team]` stal poäng |
| `robin_hood_from_msg` | 🏹 **ROBIN HOOD!** Poäng omfördelades |
| `duel_received_msg` | ⚔️ **DUEL!** `[team]` attackerades |
| `photo_rated_earned` | 📸 **FOTO GODKÄNT!** `[team]` fick `[points]` poäng |
| `sabotage_msg` | 💥 **SABOTAGE!** Alla lag tappar poäng |
| `double_points_msg` | ⚡ **DUBBLA POÄNG!** Alla lag får dubbelt |
| `final_frenzy_msg` | 🔥 **FINAL FRENZY!** |
| `hot_potato_msg` / `hot_potato_penalty_msg` | 🥔 **HET POTATIS!** |

Overlay styling: dark semi-transparent background, large centered emoji + bold text, animated entrance (scale + fade in), auto-dismiss after 4 seconds.

---

## Data Flow

```
Admin dashboard
  → click "📺 Presenter"
  → window.open('/present/[gameKey]', '_blank')

PresentPage mounts
  → fetch /api/present/[gameKey] immediately
  → render layout with initial data
  → setInterval every 4s:
      fetch /api/present/[gameKey]
      diff pending_notification per team → trigger overlay if changed
      update leaderboard + photos
```

---

## Error States

- **Game not found**: show "Spelet hittades inte" centered on screen
- **Game not started yet**: show game name + "Spelet har inte startat än" + polling continues
- **Network error**: silently retry next poll (no visible error — screen just doesn't update)

---

## Out of Scope

- Authentication for the presenter URL (it's public read-only)
- Multiple simultaneous overlays (only one shown at a time; subsequent ones queue and show after the current dismisses)
- Sound effects
- Custom branding / theming
