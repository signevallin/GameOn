# Remote Missions — Relay & Shared Secret Design Spec

## Goal

Add two new mission types purpose-built for remote mode: `relay` (sequential challenges unlocked per team member) and `shared_secret` (distributed clues that require verbal coordination on the team's video call). Both ship with built-in examples and are fully customisable by admins.

---

## Context

Remote mode teams are colleagues working from home or different offices, each on their own phone, with a video call running in parallel. The new Realtime broadcast channel (~50 ms sync) makes sequential unlocking and instant state transitions practical without polling.

---

## Data Model

### `MissionType` additions

```ts
// lib/missions.ts
export type MissionType =
  | ... // existing types
  | 'relay'
  | 'shared_secret';
```

### Mission `data` field shapes

**Relay:**
```json
{
  "segments": [
    { "prompt": "The quick brown fox jumps over the lazy dog" },
    { "prompt": "Pack my box with five dozen liquor jugs" },
    { "prompt": "How vexingly quick daft zebras jump" }
  ]
}
```

Each segment maps to the team member at that index (join order). If more members than segments, excess members share the last segment. If fewer members than segments, orphaned segments are skipped.

**Shared Secret:**
```json
{
  "clues": ["Det är vitt", "Det finns i varje kök", "Det används för att bevara mat"],
  "answer": "salt",
  "hint": "Tänk matlagning"
}
```

Member at index `i` sees clue `i`. If more members than clues, members share the last clue. If fewer, extra clues are unused.

### New DB column

```sql
ALTER TABLE teams ADD COLUMN relay_state JSONB;
```

**`relay_state` shape** (keyed by `missionId`):
```json
{
  "<missionId>": {
    "activeIndex": 1,
    "startedAt": "2026-06-11T10:00:00Z",
    "segments": [
      { "completedAt": "2026-06-11T10:00:05Z", "elapsedMs": 5230 }
    ]
  }
}
```

---

## Scoring

Both types use time-decay scoring:

```
score = max(0, maxPts − Math.floor(totalElapsedSeconds × decayPerSecond))
```

- **Relay:** `totalElapsedSeconds` = time from first segment start to last segment complete. `decayPerSecond` = `maxPts / (duration_minutes * 60)` (loses all points if it takes the full game duration).
- **Shared Secret:** Same formula, plus `-100 × wrongAttempts` penalty. Minimum score is 0.

---

## UX Flow

### Relay

1. Mission opens. Member at index 0 sees their prompt and a **Start** button. All other members see a queue: *"Väntar på [Namn]..."* with a progress indicator showing who's done and who's next.
2. Active member completes their segment → POST `/api/team/relay` → server updates `relay_state.activeIndex` and returns new state → server broadcasts `relay-advance` event on the Realtime channel.
3. All clients receive `relay-advance` → next member's UI unlocks instantly (~50 ms).
4. Repeat until the last member completes → mission is submitted with total elapsed time.
5. **Offline timeout:** If the active member hasn't advanced within 60 seconds, the relay API auto-advances to the next member. The skipped segment records `{ skipped: true }` and contributes 0 ms to elapsed time (so it doesn't punish the team).

### Shared Secret

1. Mission opens. Each member sees **only their own clue** — no other clues are visible. A countdown timer starts.
2. Members discuss verbally on their video call.
3. Any member can type and submit a guess via a shared input.
4. **Wrong answer:** API returns `{ correct: false }`. UI shows ❌ + penalty notice. Attempt count increments for all members via Realtime broadcast.
5. **Correct answer:** API returns `{ correct: true }`. Mission completes with time + attempt-based score.
6. The `hint` field (optional) can be revealed by any member after 2 wrong attempts — costs an additional -50 pts.

---

## Built-in Missions

| Type | ID | Name | Description |
|---|---|---|---|
| `relay` | `relay_typerace` | Ordstafett | Each member types a different pangram as fast as possible |
| `relay` | `relay_trivia` | Faktastafett | Each member answers one multiple-choice trivia question in turn |
| `shared_secret` | `secret_word` | Hemligt ord | 4 clues about a common word; team guesses together |
| `shared_secret` | `secret_code` | Den försvunna koden | Each member holds one digit of a 4-digit PIN; team reconstructs it |

All four are added to `lib/missions.ts` under a new `REMOTE` super-category.

---

## Architecture

### New files

| File | Purpose |
|---|---|
| `components/games/RelayMission.tsx` | Relay UI: active prompt, queue view, progress bar, advance logic |
| `components/games/SharedSecret.tsx` | Shared secret UI: personal clue, answer input, attempt counter, hint reveal |
| `app/api/team/relay/route.ts` | POST: advance relay segment or auto-skip; updates `relay_state`; broadcasts `relay-advance` |

### Modified files

| File | Change |
|---|---|
| `lib/missions.ts` | Add `'relay'` and `'shared_secret'` to `MissionType`; add 4 built-in missions |
| `components/screens/ChallengeScreen.tsx` | Add `case 'relay'` and `case 'shared_secret'`; pass `members` and `memberId` props |
| `app/play/page.tsx` | Handle `relay-advance` Realtime broadcast event; update relay_state locally |
| `components/screens/AdminScreen.tsx` | Extend custom mission form with dynamic segment fields (relay) and clue fields (shared_secret) |
| `supabase/migrations/` | Migration: `ALTER TABLE teams ADD COLUMN relay_state JSONB` |

### API: `POST /api/team/relay`

Request:
```json
{ "teamId": "...", "missionId": "...", "action": "advance" | "skip", "elapsedMs": 5230 }
```

Response:
```json
{ "relayState": { ... }, "complete": false }
```

On `complete: true`, the client calls the existing mission-submit flow with the total elapsed score.

### Realtime events (broadcast on `remote-nav-{teamId}`)

| Event | Payload | Purpose |
|---|---|---|
| `relay-advance` | `{ missionId, activeIndex, segments }` | Unlock next member, update progress UI |
| `secret-attempt` | `{ missionId, attempts, correct }` | Sync attempt count + result to all members |

---

## Out of Scope

- Relay segments of different types per member (all segments are the same type within one relay mission)
- Video/audio recording within the app
- Async relay where members complete at different times without sequential unlocking
