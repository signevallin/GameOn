# Remote / Distributed Team Mode — Design Spec

**Date:** 2026-06-09

---

## Goal

Enable global and distributed teams to play GameOn with each team member on their own device, while still sharing a team score, a real-time mission portal, and live presence indicators. This is exposed as an opt-in toggle when creating a new game.

## Architecture

### Core principle
All new logic is gated behind `game.remote_mode`. Classic mode (single shared device per team) is completely unaffected. No existing game data is migrated.

### Polling-based real-time
GameOn already polls `/api/team/status` every 5 seconds. Remote mode piggybacks on this: the status response is extended to include team members and their online status. No WebSocket or Supabase Realtime channels are needed.

---

## Data Model

### `games` table — new column
```sql
ALTER TABLE games ADD COLUMN remote_mode BOOLEAN NOT NULL DEFAULT false;
```

### `teams` table — new column
```sql
ALTER TABLE teams ADD COLUMN join_code TEXT;
-- join_code is a 4-character uppercase string, e.g. "X7K2"
-- Unique per team within a game (enforced by the login route, not a DB constraint)
-- NULL for classic-mode games
```

### New table: `team_members`
```sql
CREATE TABLE team_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX team_members_team_id_idx ON team_members(team_id);
```

### RLS
`team_members` is only accessed via the service-role key (server-side routes). Enable RLS with no policies (same pattern as other tables in this project).

---

## Join / Login Flow

### LoginScreen — classic mode (unchanged)
Fields: game key → team name → join.

### LoginScreen — remote mode
After entering the game key and receiving a game with `remote_mode: true`, the UI shows four fields:

```
Game key:    [ABC123]   ← pre-filled, read-only
Team name:   [__________]
Team code:   [X7K2]     ← 4 chars, large monospace font
Your name:   [__________]  ← first name only
```

Helper text below team code: *"Same code for everyone on your team — decide it together."*

### `POST /api/team/login` — extended for remote mode

**New request body fields (ignored if `remote_mode = false`):**
- `joinCode: string` — the 4-character team code
- `memberName: string` — the individual's first name

**Remote mode logic:**
1. Look up game by `game_key` (same as today).
2. Check `game.remote_mode`. If false, run classic logic unchanged.
3. If true:
   - Find team: `SELECT * FROM teams WHERE game_id = $gameId AND name = $teamName AND join_code = $joinCode`.
   - **Team found:** create a `team_members` row with `{ team_id, name: memberName }`. Return `{ team, memberId, memberName, game, customMissions }`.
   - **Team not found:** create a new `teams` row with `join_code`, then create a `team_members` row. Return same shape.
4. Team member cap: maximum 20 members per team. Return HTTP 409 with `{ error: 'Team is full.' }` if exceeded.

**Response shape (remote mode):**
```json
{
  "team": { ...existing team fields... },
  "memberId": "uuid",
  "memberName": "Anna",
  "game": { ...existing game fields... },
  "customMissions": [...]
}
```

**Error states:**
- Wrong team name + join code combination → `{ error: "Team code or name doesn't match. Check with your team." }` HTTP 404
- Team full → `{ error: "Team is full." }` HTTP 409
- `memberName` missing in remote mode → HTTP 400

### localStorage (remote mode)
```json
{
  "teamId": "...",
  "memberId": "...",
  "memberName": "Anna",
  "gameKey": "ABC123"
}
```
Classic mode localStorage is unchanged: `{ teamId, teamName, gameKey }`.

---

## Heartbeat

**New route: `POST /api/team/heartbeat`**

```
Body:    { memberId: string }
Returns: { ok: true }
```

- Updates `last_seen_at = now()` on the `team_members` row.
- MissionsScreen calls this every 30 seconds when `game.remote_mode = true`.
- No auth required (memberId is the credential — it's a UUID, unguessable).
- Online threshold: `last_seen_at > now() - 60 seconds`.

---

## MissionsScreen — Remote Mode Additions

### Online member bar
A compact row rendered below the game header, visible only in remote mode:

```
👤 Anna 🟢   👤 Erik 🟢   👤 Priya ⚫
```

- 🟢 = online (last_seen_at within 60 s)
- ⚫ = offline / not yet joined
- Data comes from the existing status poll response (extended with `members` array)
- The current member's own name is shown with a subtle highlight

### Status poll extension
`GET /api/team/status` is extended: in remote mode, the response includes:
```json
{
  ...existing fields...,
  "members": [
    { "id": "uuid", "name": "Anna", "online": true },
    { "id": "uuid", "name": "Erik", "online": true },
    { "id": "uuid", "name": "Priya", "online": false }
  ]
}
```
Members are ordered by `created_at` ascending (join order).

### Mission completion (first-to-submit)
No changes needed. The existing score/answer routes check `team.completed` before awarding points. The second member to submit gets a "mission already completed" response. The UI already handles this gracefully by showing completed missions as locked.

### Everything else unchanged
ChallengeScreen, photo upload, powerups, duels — all work identically via `teamId`.

---

## Admin — Remote Mode Additions

### Game creation toggle
In "Create a New Game", a new row is added below the existing settings (language, leaderboard toggle, etc.):

```
[ ] Remote / Distributed mode
    Each team member joins on their own device.
```

Sends `remote_mode: boolean` to `POST /api/admin/game`.

### Live game view — expandable team cards
When `game.remote_mode = true`, each team card in the active game view gets a chevron (▾). Clicking expands the card to show members:

```
┌────────────────────────────────────┐
│ 🏆 Team Stockholm    847 pts  ▾   │
├────────────────────────────────────┤
│  🟢 Anna   🟢 Erik   ⚫ Priya     │
└────────────────────────────────────┘
```

Member data is included in the existing `GET /api/admin/teams` response (extended).

### `GET /api/admin/teams` — extended
When a team has `join_code` set (i.e., remote mode), include members:
```json
{
  "teams": [
    {
      ...existing team fields...,
      "members": [
        { "name": "Anna", "online": true },
        { "name": "Erik", "online": true },
        { "name": "Priya", "online": false }
      ]
    }
  ]
}
```
Online = `last_seen_at > now() - 60s`. Computed server-side.

### Everything else unchanged
Presenter mode, photo review, powerup panel, mystery box — unaffected.

---

## API Summary

| Route | Change |
|-------|--------|
| `POST /api/admin/game` | Accept `remote_mode: boolean`, store on game |
| `POST /api/team/login` | Handle remote join: `joinCode` + `memberName`, create `team_members` row |
| `GET /api/team/status` | In remote mode: include `members` array with online status |
| `GET /api/admin/teams` | In remote mode: include `members` array per team |
| `POST /api/team/heartbeat` | **New** — update `last_seen_at` for a member |

---

## Out of Scope (Future Sub-Projects)

- **Stafett-uppdrag (Relay missions)** — multi-step missions that unlock sequentially. Separate sub-project built on top of this foundation.
- **Voice/video** — third-party WebRTC integration (Daily.co, Livekit). Separate project.
- **Photo collage** — AI-merged selfies from individual team members. Separate feature.

---

## Key Design Decisions

- **Polling over WebSockets** — reuses existing 5-second poll pattern; no new infrastructure.
- **join_code = 4 uppercase chars** — short enough to dictate verbally, unique enough to avoid collisions within a game.
- **Max 20 members per team** — prevents abuse; covers the vast majority of real-world use cases.
- **Member cap enforced in route** — not a DB constraint, to keep the error message user-friendly.
- **Classic mode fully unchanged** — `remote_mode = false` games follow exactly the same code path as today.
