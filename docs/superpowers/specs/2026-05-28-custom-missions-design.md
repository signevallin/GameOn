# Custom Missions – Design Spec
_Date: 2026-05-28_

## Background

GameOn customers need to create company-specific missions tailored to their brand, culture or event. Today there is a hardcoded "GKN Aerospace" category in `lib/missions.ts`. This spec replaces it with a per-customer custom section that each admin can name and populate through the admin panel.

---

## Scope

Each customer gets **one** custom mission section with:
- A customisable category name (replaces "GKN Aerospace")
- Unlimited missions of these types: `trivia_quiz`, `truefalse`, `closest_wins`, `pa_sparet`, `timeline`, `photo`
- `image_quiz` is deferred to a later version (requires image upload)

The hardcoded GKN Aerospace missions remain in `lib/missions.ts` but are hidden from new customers; they will be removed in a follow-up cleanup once the custom system is live.

---

## Database

### New table: `custom_missions`

```sql
CREATE TABLE custom_missions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_name TEXT NOT NULL DEFAULT 'My Missions',
  name          TEXT NOT NULL,
  icon          TEXT NOT NULL DEFAULT '⭐',
  desc          TEXT NOT NULL DEFAULT '',
  difficulty    TEXT NOT NULL DEFAULT 'medium'
                  CHECK (difficulty IN ('easy','medium','hard')),
  max_pts       INT  NOT NULL DEFAULT 500,
  type          TEXT NOT NULL
                  CHECK (type IN ('trivia_quiz','truefalse','closest_wins',
                                  'pa_sparet','timeline','photo')),
  data          JSONB NOT NULL DEFAULT '{}',
  sort_order    INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE custom_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_missions_owner"
  ON custom_missions
  USING (user_id = auth.uid());
```

### `data` JSONB schema per type

| type | data shape |
|---|---|
| `trivia_quiz` | `{ rounds: [{ question: string, options: string[4], answer: string }] }` |
| `truefalse` | `{ statements: [{ text: string, answer: boolean }] }` |
| `closest_wins` | `{ questions: [{ q: string, answer: number, unit: string, hint: string }] }` |
| `pa_sparet` | `{ clues: string[], answer: string }` |
| `timeline` | `{ items: [{ label: string, year: number }] }` |
| `photo` | `{ prompt: string }` |

Minimum content per type: `trivia_quiz` ≥ 1 round, `truefalse` ≥ 2 statements, `closest_wins` ≥ 1 question, `pa_sparet` ≥ 2 clues + answer, `timeline` ≥ 3 items, `photo` non-empty prompt.

---

## API Routes

All routes require `Authorization: Bearer <token>` (same pattern as other admin routes).

| Route | Method | Description |
|---|---|---|
| `/api/admin/custom-missions` | GET | List all custom missions for the authenticated user |
| `/api/admin/custom-missions` | POST | Create a new custom mission |
| `/api/admin/custom-missions/[id]` | PUT | Update an existing mission |
| `/api/admin/custom-missions/[id]` | DELETE | Delete a mission |
| `/api/admin/custom-missions/category` | POST | Update `category_name` for all of the user's missions |

The **`/api/team/login`** response is extended to include the game's custom missions (fetched by `user_id` of the game owner), so the client loads them once at join time.

---

## Admin UI

### New "My Missions" tab in AdminScreen

Shown in the top-level view (when no active game is selected), alongside the existing "Games" tab.

**Layout:**
1. **Category name row** — text input "Category name (shown to teams)" + Save button. Saving calls `/api/admin/custom-missions/category` and updates `category_name` on all the user's missions.
2. **Mission list** — each row shows `{icon} {name}` · `{type}` · `{difficulty}` with Edit and Delete buttons.
3. **"+ Add mission" button** — expands an inline creation form below the list.

**Inline form fields (always shown):**
- Name (text)
- Icon (text, single emoji, default ⭐)
- Description (text)
- Difficulty (select: Easy / Medium / Hard)
- Max points (number, default 500)
- Type (select: Trivia · True/False · Closest Wins · På Spåret · Timeline · Photo)

**Type-specific content (shown after type is selected):**

*Trivia Quiz* — a list of rounds. Each round: question (text), 4 answer options (text × 4), correct answer (radio). "+ Add question" appends a new empty round.

*True / False* — a list of statements. Each: text + True/False toggle. "+ Add statement" appends a new one.

*Closest Wins* — a list of questions. Each: question text, numeric answer, unit (e.g. "employees"), hint text. "+ Add question" appends a new one.

*På Spåret* — clues list (one text per clue, ordered), final answer text. "+ Add clue" appends a new clue.

*Timeline* — event list. Each: label text + year (number). "+ Add event" appends a new one.

*Photo* — single text field: "What should teams photograph?"

**Validation:** The form prevents saving if required minimum content is missing (e.g. trivia with zero rounds). Inline error message appears next to the Save button.

### Game creation mission picker

Custom missions appear as a category group named after the customer's `category_name`, alongside "IT", "Fun", etc. The picker already groups by category — no structural changes needed, just the data source is extended.

The hardcoded `category: 'GKN Aerospace'` missions are **filtered out of the picker** for all customers (they are company-specific content not relevant to other customers). The super-admin sees them. GKN-specific missions remain in `lib/missions.ts` but are excluded via a constant `HIDDEN_CATEGORIES = ['GKN Aerospace']` checked in the picker.

---

## Client-side Data Flow

```
Team logs in → /api/team/login returns { team, game, customMissions[] }
page.tsx stores customMissions in state
↓
MissionsScreen receives customMissions as prop
  → merges with static MISSIONS for display
ChallengeScreen receives customMissions as prop
  → looks up mission in MISSIONS first, then customMissions
```

**Custom mission objects** passed to the client conform to the same `Mission` type from `lib/supabase.ts` (the type already has optional fields covering all needed properties). The `id` is the UUID from the database row.

**`lib/supabase.ts`** gets a new exported type:

```typescript
export type CustomMission = {
  id: string;
  user_id: string;
  category_name: string;
  name: string;
  icon: string;
  desc: string;
  difficulty: 'easy' | 'medium' | 'hard';
  max_pts: number;
  type: string;
  data: Record<string, unknown>;
  sort_order: number;
  created_at: string;
};
```

The `toMission(cm: CustomMission): Mission` helper in a new `lib/custom-missions.ts` converts a `CustomMission` row into a `Mission` object the game components can consume directly.

---

## Files Changed / Created

| File | Action |
|---|---|
| `docs/sql/2026-05-28-custom-missions.sql` | Create — migration SQL |
| `lib/supabase.ts` | Add `CustomMission` type |
| `lib/custom-missions.ts` | Create — `toMission()` converter |
| `app/api/admin/custom-missions/route.ts` | Create — GET + POST |
| `app/api/admin/custom-missions/[id]/route.ts` | Create — PUT + DELETE |
| `app/api/admin/custom-missions/category/route.ts` | Create — POST (update category name) |
| `app/api/team/login/route.ts` | Modify — include custom missions in response |
| `components/screens/AdminScreen.tsx` | Add "My Missions" tab + form |
| `components/screens/MissionsScreen.tsx` | Accept + merge `customMissions` prop |
| `components/screens/ChallengeScreen.tsx` | Accept + look up from `customMissions` |
| `app/page.tsx` | Store `customMissions` state, pass as prop |

---

## Out of Scope (v1)

- `image_quiz` type (requires Supabase Storage upload)
- Sharing custom missions between customers
- Per-game custom missions (all games share the same custom section)
- Removing the hardcoded GKN Aerospace missions from `lib/missions.ts` (cleanup task)
