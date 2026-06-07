# AI Photo Rating Design

**Date:** 2026-06-07
**Status:** Approved

---

## Goal

Let admins choose between rating photos manually or having Claude automatically rate them. The setting is configured per game at creation time and can be overridden live in the Photos tab during a game. Both regular photo missions and Scavenger Hunt photos are covered. Admins can always override an AI-set score after the fact.

## Scope

This feature touches:
- A Supabase migration (two new columns on `games`, one on `photo_submissions`)
- One new shared utility (`lib/ai-photo-rater.ts`)
- Two modified player-facing API routes (`/api/team/photo`, `/api/scavenger/submit`)
- One new admin API route (`PATCH /api/admin/game/[id]`)
- One modified admin API route (`POST /api/admin/game` — create game)
- UI changes in `AdminScreen.tsx` (create-game form + Photos tab)

---

## Data Model

### New columns via migration

```sql
-- games table
alter table public.games
  add column if not exists ai_photo_rating boolean not null default false,
  add column if not exists ai_photo_instructions text;

-- photo_submissions table
alter table public.photo_submissions
  add column if not exists ai_rated boolean not null default false;
```

- **`games.ai_photo_rating`** — AI mode on/off for the game. Set at creation, updatable live via PATCH.
- **`games.ai_photo_instructions`** — Optional free-text from the admin (e.g. "Reward creativity and humor extra highly"). Injected into the AI prompt verbatim.
- **`photo_submissions.ai_rated`** — `true` when points were set by AI, `false` when set manually. Used for badge display in the Photos tab.

---

## AI Evaluation Logic

**Model:** `claude-3-haiku-20240307` — fast (~500ms) and cheap for vision tasks.

### Prompt structure

```
You are judging a photo submission for a team competition.

Mission: [mission.name] — [mission.desc or custom photoPrompt]
Max points: [maxPts]
[If ai_photo_instructions present:]
Extra scoring focus from the organizer: [ai_photo_instructions]

Award points on this scale:
- 0: Photo is completely off-topic or missing
- [25% of maxPts]: Attempted but barely matches the mission
- [50% of maxPts]: Acceptable effort, partially matches
- [75% of maxPts]: Good match, clearly understood the mission
- [maxPts]: Perfect — exactly what was asked, excellent execution

Respond with ONLY a JSON object: {"points": <number>}
```

For Scavenger Hunt items, the mission line is replaced with:
```
Mission: Scavenger Hunt — teams must photograph: [item_label]. Did they find it?
```

### Scoring
- Claude returns a raw number; it is rounded to the nearest valid point option (same steps as `getPointOptions(maxPts)` in the frontend — 0, 25%, 50%, 75%, 100% of maxPts).
- If the Claude call fails (network error, timeout, malformed JSON), the submission stays `status: 'pending'` and `ai_rated: false` — admin sees it in the Photos tab and can rate manually as usual. The error is logged server-side.

---

## API Routes

### New: `lib/ai-photo-rater.ts`

Shared utility. Exported function:

```typescript
export async function ratePhoto(params: {
  photoUrl: string;
  missionDescription: string;  // "Mission name — desc"
  maxPts: number;
  scoringFocus?: string | null; // games.ai_photo_instructions
}): Promise<number>             // returns awarded points, already rounded
```

Uses the Anthropic SDK (already installed). Falls back to `throw` on failure — callers catch and keep submission pending.

### Modified: `POST /api/team/photo/route.ts`

After inserting the `photo_submissions` record:
1. Fetch `games` row for the team's game_id: select `ai_photo_rating`, `ai_photo_instructions`, `mission_max_pts`.
2. If `ai_photo_rating = true`:
   - Look up mission description from `MISSIONS` (or fall back to mission_id as label for custom missions).
   - Call `ratePhoto({ photoUrl, missionDescription, maxPts, scoringFocus })`.
   - On success: update `photo_submissions` with `status: 'rated'`, `points_awarded`, `ai_rated: true`; update team score and `completed`/`mission_scores` exactly as `/api/admin/photos/rate` does; send `pending_notification` to the team.
   - On failure: log error, leave submission as `status: 'pending'` — no score update.
3. Return `{ ok: true }` to the player regardless (AI step is transparent to the player).

### Modified: `POST /api/scavenger/submit/route.ts`

Same pattern as above, but `missionDescription` is `"Scavenger Hunt — teams must photograph: [item_label]. Did they find it?"` and `maxPts` is the scavenger item's point value (look up from game's scavenger config or default 500).

### New: `PATCH /api/admin/game/[id]/route.ts`

Updates `ai_photo_rating` and/or `ai_photo_instructions` on a specific game. Admin only, ownership-checked.

Request body:
```json
{
  "ai_photo_rating": true,
  "ai_photo_instructions": "Reward creativity and humor extra highly"
}
```

Response: `{ "ok": true }`

### Modified: `POST /api/admin/game/route.ts` (create game)

Accept two new fields in the create-game action:
- `ai_photo_rating: boolean` (default `false`)
- `ai_photo_instructions: string | null` (default `null`)

Include them in the `insert` call.

---

## UI — AdminScreen

### Create-game form

New state:
```typescript
const [aiPhotoRating, setAiPhotoRating] = useState(false);
const [aiPhotoInstructions, setAiPhotoInstructions] = useState('');
```

New toggle row (after "Hide leaderboard" toggle):
- Label: **"AI photo rating ✨"**, subtitle: "Photos rated automatically — you can override anytime"
- When toggled on: a "Scoring focus (optional)" text input expands below the toggle
- Placeholder: `"e.g. Reward creativity and humor extra highly"`
- Helper text: "Passed to the AI as extra context when rating photos"

Both values sent in the create-game API call.

### Photos tab — live toggle

New state:
```typescript
const [aiRatingEnabled, setAiRatingEnabled] = useState(false);
const [aiRatingInstructions, setAiRatingInstructions] = useState('');
```

Initialised from `activeGame.ai_photo_rating` / `activeGame.ai_photo_instructions` when the game loads.

**Tab header:** AI rating toggle (ON/OFF) to the right of the "📸 Photos" heading.

When toggled: calls `PATCH /api/admin/game/[id]` with `{ ai_photo_rating: <new value>, ai_photo_instructions: aiRatingInstructions }` (instructions unchanged — they can only be set at game creation); updates local state on success.

**Info card** (visible when AI is on):
- "✨ AI rating is on — Photos are rated automatically when submitted"
- If `aiRatingInstructions` is set: shows it as "Focus: [text]"

**Photo cards:**
- `ai_rated: true` → badge: `✨ AI • Xp` + "Override points" button
- `ai_rated: false`, rated → badge: `✏️ Manual • Xp`
- "Override points" button opens the same point-option buttons as manual rating, calls the existing `/api/admin/photos/rate` endpoint, and sets `ai_rated: false` on the submission

Same badge logic applies to Scavenger Hunt photo cards.

---

## Out of Scope

- Per-mission AI instructions (all instructions are per-game)
- AI explanation/reasoning shown to admin or teams
- AI rating for non-photo mission types (text answers, etc.)
- Retroactive AI rating of already-submitted photos when toggling AI on mid-game
