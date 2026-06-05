# Custom Missions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each customer create one custom mission category with their own company-specific missions (trivia, true/false, closest wins, på spåret, timeline, photo), replacing the hardcoded GKN Aerospace section.

**Architecture:** Custom missions are stored per-user in a `custom_missions` Supabase table. A `toMission()` converter maps DB rows to the existing `Mission` type so all game components work without changes. The team login response includes the game owner's custom missions; page.tsx stores them and passes them as props to MissionsScreen and ChallengeScreen.

**Tech Stack:** Next.js App Router, Supabase PostgreSQL, TypeScript, React.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `docs/sql/2026-05-28-custom-missions.sql` | Create | DB migration |
| `lib/supabase.ts` | Modify | Add `CustomMission` type |
| `lib/custom-missions.ts` | Create | `toMission()` converter + validation |
| `app/api/admin/custom-missions/route.ts` | Create | GET list + POST create |
| `app/api/admin/custom-missions/[id]/route.ts` | Create | PUT update + DELETE |
| `app/api/admin/custom-missions/category/route.ts` | Create | POST update category name |
| `app/api/team/login/route.ts` | Modify | Return custom missions in response |
| `app/page.tsx` | Modify | Store `customMissions` state + pass as prop |
| `components/screens/MissionsScreen.tsx` | Modify | Accept + render custom missions category |
| `components/screens/ChallengeScreen.tsx` | Modify | Accept + look up custom missions |
| `components/screens/AdminScreen.tsx` | Modify | My Missions view + hide GKN + picker |

---

## Task 1: SQL Migration

**Files:**
- Create: `docs/sql/2026-05-28-custom-missions.sql`

- [ ] **Step 1: Create the SQL file**

```bash
touch /Users/signevallin/Desktop/GameOn/docs/sql/2026-05-28-custom-missions.sql
```

Write this content:

```sql
-- docs/sql/2026-05-28-custom-missions.sql
-- Run once in the Supabase SQL Editor.

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

-- Customers can CRUD their own; service role bypasses RLS for admin API routes
CREATE POLICY "custom_missions_owner"
  ON custom_missions
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Open https://supabase.com/dashboard → your project → SQL Editor → paste and run.

- [ ] **Step 3: Commit**

```bash
cd /Users/signevallin/Desktop/GameOn
git add docs/sql/2026-05-28-custom-missions.sql
git commit -m "chore: add custom_missions DB migration SQL"
```

---

## Task 2: Types + Converter

**Files:**
- Modify: `lib/supabase.ts`
- Create: `lib/custom-missions.ts`

- [ ] **Step 1: Add `CustomMission` type to `lib/supabase.ts`**

Open `lib/supabase.ts`. After the `Game` type definition, add:

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

- [ ] **Step 2: Create `lib/custom-missions.ts`**

```typescript
// lib/custom-missions.ts
import { Mission } from '@/lib/missions';
import { CustomMission } from '@/lib/supabase';

/**
 * Converts a CustomMission DB row into the Mission shape
 * the game components expect. All game components work unchanged.
 */
export function toMission(cm: CustomMission): Mission {
  const base = {
    id: cm.id,
    icon: cm.icon,
    name: cm.name,
    category: cm.category_name,
    desc: cm.desc,
    difficulty: cm.difficulty as Mission['difficulty'],
    maxPts: cm.max_pts,
    type: cm.type as Mission['type'],
  };

  const d = cm.data as Record<string, unknown>;

  switch (cm.type) {
    case 'trivia_quiz':
      return { ...base, triviaRounds: (d.rounds as Mission['triviaRounds']) ?? [] };
    case 'truefalse':
      return { ...base, statements: (d.statements as Mission['statements']) ?? [] };
    case 'closest_wins':
      return { ...base, closestWinsQuestions: (d.questions as Mission['closestWinsQuestions']) ?? [] };
    case 'pa_sparet':
      return { ...base, clues: (d.clues as string[]) ?? [], answer: d.answer as string };
    case 'timeline':
      return { ...base, timelineItems: (d.items as Mission['timelineItems']) ?? [] };
    case 'photo':
      return { ...base, question: d.prompt as string };
    default:
      return base as Mission;
  }
}

/** Returns an error string or null if valid. */
export function validateMissionData(
  type: string,
  data: {
    triviaRounds: { question: string; options: string[]; answer: string }[];
    statements: { text: string; answer: boolean }[];
    closestQuestions: { q: string; answer: string; unit: string; hint: string }[];
    clues: string[];
    paAnswer: string;
    timelineItems: { label: string; year: string }[];
    photoPrompt: string;
  }
): string | null {
  switch (type) {
    case 'trivia_quiz':
      if (data.triviaRounds.length < 1) return 'Add at least 1 question.';
      for (const r of data.triviaRounds) {
        if (!r.question.trim()) return 'All questions need text.';
        if (r.options.some(o => !o.trim())) return 'All 4 options are required.';
        if (!r.answer) return 'Select the correct answer for each question.';
      }
      return null;
    case 'truefalse':
      if (data.statements.length < 2) return 'Add at least 2 statements.';
      for (const s of data.statements) {
        if (!s.text.trim()) return 'All statements need text.';
      }
      return null;
    case 'closest_wins':
      if (data.closestQuestions.length < 1) return 'Add at least 1 question.';
      for (const q of data.closestQuestions) {
        if (!q.q.trim()) return 'All questions need text.';
        if (!q.answer || isNaN(Number(q.answer))) return 'Answer must be a number.';
      }
      return null;
    case 'pa_sparet':
      if (data.clues.length < 2) return 'Add at least 2 clues.';
      if (data.clues.some(c => !c.trim())) return 'All clues need text.';
      if (!data.paAnswer.trim()) return 'Answer is required.';
      return null;
    case 'timeline':
      if (data.timelineItems.length < 3) return 'Add at least 3 events.';
      for (const i of data.timelineItems) {
        if (!i.label.trim()) return 'All events need a label.';
        if (!i.year || isNaN(Number(i.year))) return 'All events need a valid year.';
      }
      return null;
    case 'photo':
      if (!data.photoPrompt.trim()) return 'Photo prompt is required.';
      return null;
    default:
      return 'Unknown type.';
  }
}

/** Builds the JSONB `data` object to store in the DB from form state. */
export function buildMissionData(
  type: string,
  data: {
    triviaRounds: { question: string; options: string[]; answer: string }[];
    statements: { text: string; answer: boolean }[];
    closestQuestions: { q: string; answer: string; unit: string; hint: string }[];
    clues: string[];
    paAnswer: string;
    timelineItems: { label: string; year: string }[];
    photoPrompt: string;
  }
): Record<string, unknown> {
  switch (type) {
    case 'trivia_quiz':
      return { rounds: data.triviaRounds };
    case 'truefalse':
      return { statements: data.statements };
    case 'closest_wins':
      return {
        questions: data.closestQuestions.map(q => ({
          q: q.q,
          answer: Number(q.answer),
          unit: q.unit,
          hint: q.hint,
        })),
      };
    case 'pa_sparet':
      return { clues: data.clues.filter(c => c.trim()), answer: data.paAnswer };
    case 'timeline':
      return {
        items: data.timelineItems.map(i => ({ label: i.label, year: Number(i.year) })),
      };
    case 'photo':
      return { prompt: data.photoPrompt };
    default:
      return {};
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase.ts lib/custom-missions.ts
git commit -m "feat: add CustomMission type and toMission converter"
```

---

## Task 3: CRUD API Routes

**Files:**
- Create: `app/api/admin/custom-missions/route.ts`
- Create: `app/api/admin/custom-missions/[id]/route.ts`
- Create: `app/api/admin/custom-missions/category/route.ts`

- [ ] **Step 1: Create directories**

```bash
mkdir -p /Users/signevallin/Desktop/GameOn/app/api/admin/custom-missions/category
mkdir -p /Users/signevallin/Desktop/GameOn/app/api/admin/custom-missions/\[id\]
```

- [ ] **Step 2: Create `app/api/admin/custom-missions/route.ts`**

```typescript
// app/api/admin/custom-missions/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { data, error } = await getSupabase()
    .from('custom_missions')
    .select('*')
    .eq('user_id', admin.userId)
    .order('sort_order')
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ missions: data ?? [] });
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const body = await req.json();
  const { category_name, name, icon, desc, difficulty, max_pts, type, data, sort_order } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (!type) return NextResponse.json({ error: 'Type is required.' }, { status: 400 });

  const { data: mission, error } = await getSupabase()
    .from('custom_missions')
    .insert({
      user_id: admin.userId,
      category_name: category_name ?? 'My Missions',
      name: name.trim(),
      icon: icon ?? '⭐',
      desc: desc ?? '',
      difficulty: difficulty ?? 'medium',
      max_pts: max_pts ?? 500,
      type,
      data: data ?? {},
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mission });
}
```

- [ ] **Step 3: Create `app/api/admin/custom-missions/[id]/route.ts`**

```typescript
// app/api/admin/custom-missions/[id]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { id } = params;
  const body = await req.json();

  // Verify ownership
  const { data: existing } = await getSupabase()
    .from('custom_missions').select('user_id').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (existing.user_id !== admin.userId && !admin.isSuperAdmin) return unauthorizedResponse();

  const { name, icon, desc, difficulty, max_pts, type, data, sort_order } = body;

  const { data: mission, error } = await getSupabase()
    .from('custom_missions')
    .update({
      name: name?.trim(),
      icon,
      desc,
      difficulty,
      max_pts,
      type,
      data,
      sort_order,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mission });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { id } = params;

  // Verify ownership
  const { data: existing } = await getSupabase()
    .from('custom_missions').select('user_id').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (existing.user_id !== admin.userId && !admin.isSuperAdmin) return unauthorizedResponse();

  const { error } = await getSupabase().from('custom_missions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Create `app/api/admin/custom-missions/category/route.ts`**

```typescript
// app/api/admin/custom-missions/category/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { category_name } = await req.json();
  if (!category_name?.trim()) return NextResponse.json({ error: 'Category name is required.' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from('custom_missions')
    .update({ category_name: category_name.trim() })
    .eq('user_id', admin.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/custom-missions/
git commit -m "feat: add custom missions CRUD API routes"
```

---

## Task 4: Extend Team Login

**Files:**
- Modify: `app/api/team/login/route.ts`

The team login response must include the game owner's custom missions so the client can render them without extra API calls.

- [ ] **Step 1: Read the current file**

```bash
cat /Users/signevallin/Desktop/GameOn/app/api/team/login/route.ts
```

- [ ] **Step 2: Replace file contents**

```typescript
// app/api/team/login/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { name, gameKey } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: 'Enter a team name.' }, { status: 400 });
  if (!gameKey?.trim()) return NextResponse.json({ error: 'Enter a game key.' }, { status: 400 });

  // Find game
  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('*')
    .eq('game_key', gameKey.toUpperCase())
    .single();

  if (gameErr || !game) return NextResponse.json({ error: 'Wrong game key. Ask the organiser.' }, { status: 404 });
  if (game.status === 'finished') return NextResponse.json({ error: 'This game is already finished.' }, { status: 400 });

  // Fetch custom missions for this game's owner (in parallel with team lookup)
  const [teamResult, customMissionsResult] = await Promise.all([
    supabase.from('teams').select('*').eq('name', name.trim()).eq('game_id', game.id).single(),
    game.user_id
      ? supabase.from('custom_missions').select('*').eq('user_id', game.user_id).order('sort_order').order('created_at')
      : Promise.resolve({ data: [] }),
  ]);

  const customMissions = customMissionsResult.data ?? [];

  if (teamResult.data) {
    // Team already exists — return as-is (preserve score and completed missions)
    return NextResponse.json({ team: teamResult.data, game, customMissions });
  }

  // New team — create it
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ name: name.trim(), game_id: game.id, score: 0, completed: [] })
    .select()
    .single();

  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });

  return NextResponse.json({ team, game, customMissions });
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/team/login/route.ts
git commit -m "feat: include custom missions in team login response"
```

---

## Task 5: page.tsx — customMissions state

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Read the current file**

```bash
cat /Users/signevallin/Desktop/GameOn/app/page.tsx
```

- [ ] **Step 2: Add CustomMission import**

Find:
```typescript
import { Team, Game } from '@/lib/supabase';
```
Replace with:
```typescript
import { Team, Game, CustomMission } from '@/lib/supabase';
import { toMission } from '@/lib/custom-missions';
import { Mission } from '@/lib/missions';
```

- [ ] **Step 3: Add customMissions state after existing state declarations**

Find:
```typescript
  const [result, setResult] = useState<ResultState | null>(null);
  const [hydrated, setHydrated] = useState(false);
```
Replace with:
```typescript
  const [result, setResult] = useState<ResultState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [customMissions, setCustomMissions] = useState<Mission[]>([]);
```

- [ ] **Step 4: Update handleTeamLogin to accept and store customMissions**

Find:
```typescript
  function handleTeamLogin(t: Team, g: Game) {
    setTeam(t);
    setGame(g);
    setScreen('missions');
  }
```
Replace with:
```typescript
  function handleTeamLogin(t: Team, g: Game, cms: CustomMission[] = []) {
    setTeam(t);
    setGame(g);
    setCustomMissions(cms.map(toMission));
    setScreen('missions');
  }
```

- [ ] **Step 5: Pass customMissions to MissionsScreen**

Find:
```typescript
      <MissionsScreen
        team={team}
        game={game}
        teams={teams}
        onSelectMission={handleSelectMission}
        onLogout={handleLogout}
        onTeamUpdate={setTeam}
        onGameUpdate={setGame}
      />
```
Replace with:
```typescript
      <MissionsScreen
        team={team}
        game={game}
        teams={teams}
        customMissions={customMissions}
        onSelectMission={handleSelectMission}
        onLogout={handleLogout}
        onTeamUpdate={setTeam}
        onGameUpdate={setGame}
      />
```

- [ ] **Step 6: Pass customMissions to ChallengeScreen**

Find:
```typescript
      <ChallengeScreen
        missionId={activeMission}
        team={team}
        game={game}
        teams={teams}
        onDone={handleChallengeDone}
        onBack={() => setScreen('missions')}
      />
```
Replace with:
```typescript
      <ChallengeScreen
        missionId={activeMission}
        team={team}
        game={game}
        teams={teams}
        customMissions={customMissions}
        onDone={handleChallengeDone}
        onBack={() => setScreen('missions')}
      />
```

- [ ] **Step 7: Update LoginScreen onTeamLogin call to pass customMissions**

Open `components/screens/LoginScreen.tsx`. Find:
```typescript
      onTeamLogin(data.team, data.game);
```
Replace with:
```typescript
      onTeamLogin(data.team, data.game, data.customMissions ?? []);
```

Also update the Props type in LoginScreen:
Find:
```typescript
  onTeamLogin: (team: Team, game: Game) => void;
```
Replace with:
```typescript
  onTeamLogin: (team: Team, game: Game, customMissions?: import('@/lib/supabase').CustomMission[]) => void;
```

- [ ] **Step 8: Verify TypeScript**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add app/page.tsx components/screens/LoginScreen.tsx
git commit -m "feat: add customMissions state to page.tsx, pass to screens"
```

---

## Task 6: MissionsScreen — render custom category

**Files:**
- Modify: `components/screens/MissionsScreen.tsx`

MissionsScreen currently shows categories from `SUPER_CATEGORIES`. Custom missions live outside that structure, so we render them as a separate virtual category block.

- [ ] **Step 1: Read the top of MissionsScreen to see Props type**

```bash
sed -n '1,50p' /Users/signevallin/Desktop/GameOn/components/screens/MissionsScreen.tsx
```

- [ ] **Step 2: Add Mission import and customMissions prop**

Find the Props type definition (it will list `team`, `game`, `teams`, etc.). Add `customMissions` to it:

```typescript
  customMissions?: Mission[];
```

Add `Mission` to the imports from `@/lib/missions` if not already there:
```typescript
import { MISSIONS, Mission } from '@/lib/missions';
```

Also destructure the prop in the function signature:
```typescript
export default function MissionsScreen({ team, game, teams, customMissions = [], onSelectMission, onLogout, onTeamUpdate, onGameUpdate }: Props) {
```

- [ ] **Step 3: Build custom category stats**

Find the line:
```typescript
  const visibleMissions = MISSIONS.filter(m => game.missions.includes(m.id));
```

Add directly after it:
```typescript
  const visibleCustomMissions = customMissions.filter(m => game.missions.includes(m.id));
```

Find the `categoryStats` block (it ends with `.filter(Boolean)`). After that closing line, add:
```typescript
  const customCategoryName = visibleCustomMissions[0]?.category ?? null;
  const customCategoryDone = visibleCustomMissions.filter(m => team.completed?.includes(m.id)).length;
  const customMinPts = visibleCustomMissions.length
    ? Math.min(...visibleCustomMissions.map(m => game.mission_max_pts?.[m.id] ?? m.maxPts))
    : 0;
  const customMaxPts = visibleCustomMissions.length
    ? Math.max(...visibleCustomMissions.map(m => game.mission_max_pts?.[m.id] ?? m.maxPts))
    : 0;
```

- [ ] **Step 4: Render custom category in the category grid**

The category grid renders `categoryStats.map(...)`. After it (still inside the same `{activeTab === 'missions' && ...}` block), find where the categories are listed and add the custom category block after the `categoryStats.map(...)` call:

```typescript
              {/* ── Custom category ── */}
              {visibleCustomMissions.length > 0 && customCategoryName && selectedCategory === null && (
                <div
                  className="card"
                  style={{ cursor: 'pointer', borderColor: '#9b59b6', opacity: 1 }}
                  onClick={() => setSelectedCategory('__custom__' as SuperCategoryKey)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>⭐</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '14px', color: '#9b59b6' }}>{customCategoryName.toUpperCase()}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{customMinPts}–{customMaxPts} pts</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, fontSize: '16px', color: '#9b59b6' }}>{customCategoryDone}/{visibleCustomMissions.length}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)' }}>done</div>
                    </div>
                  </div>
                </div>
              )}
```

- [ ] **Step 5: Render custom missions when the custom category is selected**

Find where individual missions are rendered when `selectedCategory` is selected (the `missions-grid` with individual mission cards at the bottom of the missions tab). After the closing of that section but still inside `activeTab === 'missions'`, add:

```typescript
              {/* ── Custom category missions list ── */}
              {selectedCategory === ('__custom__' as SuperCategoryKey) && visibleCustomMissions.length > 0 && (
                <div className="missions-grid" style={{ paddingBottom: '40px' }}>
                  {visibleCustomMissions.map(m => {
                    const done = team.completed?.includes(m.id);
                    const pts = game.mission_max_pts?.[m.id] ?? m.maxPts;
                    return (
                      <div
                        key={m.id}
                        className="card"
                        style={{ cursor: done ? 'default' : 'pointer', opacity: done ? 0.5 : 1, borderColor: done ? 'var(--border)' : '#9b59b6' }}
                        onClick={() => !done && onSelectMission(m.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '24px' }}>{m.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>{m.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.difficulty} · {pts} pts</div>
                          </div>
                          {done && <span style={{ fontSize: '18px' }}>✅</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/screens/MissionsScreen.tsx
git commit -m "feat: render custom missions category in MissionsScreen"
```

---

## Task 7: ChallengeScreen — look up custom missions

**Files:**
- Modify: `components/screens/ChallengeScreen.tsx`

- [ ] **Step 1: Add customMissions prop**

Find the Props type:
```typescript
type Props = {
  missionId: string;
  team: Team;
  game: Game;
  teams?: Team[];
  onDone: (updatedTeam: Team, pts: number, correct: boolean, elapsed: number) => void;
  onBack: () => void;
};
```
Replace with:
```typescript
type Props = {
  missionId: string;
  team: Team;
  game: Game;
  teams?: Team[];
  customMissions?: Mission[];
  onDone: (updatedTeam: Team, pts: number, correct: boolean, elapsed: number) => void;
  onBack: () => void;
};
```

- [ ] **Step 2: Update the component signature and mission lookup**

Find:
```typescript
export default function ChallengeScreen({ missionId, team, game, teams = [], onDone, onBack }: Props) {
  const mission = MISSIONS.find(m => m.id === missionId)!;
```
Replace with:
```typescript
export default function ChallengeScreen({ missionId, team, game, teams = [], customMissions = [], onDone, onBack }: Props) {
  const mission = (MISSIONS.find(m => m.id === missionId) ?? customMissions.find(m => m.id === missionId))!;
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/screens/ChallengeScreen.tsx
git commit -m "feat: ChallengeScreen falls back to customMissions for mission lookup"
```

---

## Task 8: AdminScreen — mission picker + GKN filter

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

Two changes: (1) hide the `gkn` super-category for non-superadmin customers, (2) show custom missions as a pickable group in game creation.

- [ ] **Step 1: Add customMissions state and load function to AdminScreen**

Find the block of `useState` declarations near `authToken`, `isSuperAdmin`. Add after `customers` state:
```typescript
  const [adminCustomMissions, setAdminCustomMissions] = useState<import('@/lib/supabase').CustomMission[]>([]);
```

Find the `loadCustomers` function. After it, add:
```typescript
  async function loadAdminCustomMissions() {
    const res = await POST('/api/admin/custom-missions');
    const data = await res.json();
    if (data.missions) setAdminCustomMissions(data.missions);
  }
```

In the `useEffect` that calls `supabase.auth.getSession()` (the auth useEffect), add a `loadAdminCustomMissions()` call after `setIsSuperAdmin`:
```typescript
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSuperAdmin(user?.app_metadata?.role === 'superadmin');
      loadAdminCustomMissions();  // ← add this line
    });
```

- [ ] **Step 2: Hide GKN category in the mission picker for non-superadmin**

Find in the mission picker section (view === 'create'):
```typescript
            {(Object.keys(SUPER_CATEGORIES) as SuperCategoryKey[]).map(catKey => {
              const cat = SUPER_CATEGORIES[catKey];
              const catMissions = MISSIONS.filter(m => MISSION_SUPER_CATEGORY[m.id] === catKey);
              if (catMissions.length === 0) return null;
```
Replace with:
```typescript
            {(Object.keys(SUPER_CATEGORIES) as SuperCategoryKey[]).map(catKey => {
              if (catKey === 'gkn' && !isSuperAdmin) return null;
              const cat = SUPER_CATEGORIES[catKey];
              const catMissions = MISSIONS.filter(m => MISSION_SUPER_CATEGORY[m.id] === catKey);
              if (catMissions.length === 0) return null;
```

- [ ] **Step 3: Add custom missions group to mission picker**

Find the closing `</div>` that ends the `{(Object.keys(SUPER_CATEGORIES)...}.map(...)}` block in the picker. After it (still inside the "Select Missions" div), add:

```typescript
            {/* ── Custom missions ── */}
            {adminCustomMissions.length > 0 && (() => {
              const catName = adminCustomMissions[0].category_name;
              const allOn = adminCustomMissions.every(m => selectedMissions.includes(m.id));
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', color: '#9b59b6' }}>
                      ⭐ {catName.toUpperCase()}
                    </span>
                    <button
                      onClick={() => {
                        const ids = adminCustomMissions.map(m => m.id);
                        setSelectedMissions(prev => allOn
                          ? prev.filter(x => !ids.includes(x))
                          : [...new Set([...prev, ...ids])]);
                      }}
                      style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                    >
                      {allOn ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {adminCustomMissions.map(m => {
                      const on = selectedMissions.includes(m.id);
                      const pts = missionMaxPts[m.id] ?? m.max_pts;
                      return (
                        <div key={m.id} style={{ background: 'var(--card)', border: `1px solid ${on ? '#9b59b6' : 'var(--border)'}`, borderRadius: '8px', opacity: on ? 1 : 0.45 }}>
                          <div
                            onClick={() => {
                              setSelectedMissions(prev => on ? prev.filter(x => x !== m.id) : [...prev, m.id]);
                              if (!missionMaxPts[m.id]) setMissionMaxPts(prev => ({ ...prev, [m.id]: m.max_pts }));
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px', cursor: 'pointer' }}
                          >
                            <span style={{ fontSize: '18px' }}>{m.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: '13px' }}>{m.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.difficulty} · {m.max_pts} pts</div>
                            </div>
                            <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: on ? '#9b59b6' : 'var(--border)', position: 'relative', flexShrink: 0 }}>
                              <div style={{ position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: hide GKN in mission picker, add custom missions to picker"
```

---

## Task 9: AdminScreen — My Missions view

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

Add a full CRUD UI for the customer's custom mission section.

- [ ] **Step 1: Add `AdminView` value and form state**

Find:
```typescript
type AdminView = 'games' | 'create' | 'dashboard';
```
Replace with:
```typescript
type AdminView = 'games' | 'create' | 'dashboard' | 'missions';
```

Add these types near the top of the file (after existing type definitions):
```typescript
type MissionFormData = {
  name: string;
  icon: string;
  desc: string;
  difficulty: 'easy' | 'medium' | 'hard';
  maxPts: number;
  type: string;
  // trivia_quiz
  triviaRounds: { question: string; options: [string, string, string, string]; answer: string }[];
  // truefalse
  statements: { text: string; answer: boolean }[];
  // closest_wins
  closestQuestions: { q: string; answer: string; unit: string; hint: string }[];
  // pa_sparet
  clues: string[];
  paAnswer: string;
  // timeline
  timelineItems: { label: string; year: string }[];
  // photo
  photoPrompt: string;
};

const EMPTY_FORM: MissionFormData = {
  name: '', icon: '⭐', desc: '', difficulty: 'medium', maxPts: 500, type: '',
  triviaRounds: [], statements: [], closestQuestions: [],
  clues: [], paAnswer: '', timelineItems: [], photoPrompt: '',
};
```

- [ ] **Step 2: Add My Missions state variables**

Inside `AdminScreen` component, after `adminCustomMissions` state, add:
```typescript
  const [customCategoryName, setCustomCategoryName] = useState('My Missions');
  const [categoryNameSaving, setCategoryNameSaving] = useState(false);
  const [showMissionForm, setShowMissionForm] = useState(false);
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [missionForm, setMissionForm] = useState<MissionFormData>(EMPTY_FORM);
  const [missionFormError, setMissionFormError] = useState('');
  const [missionSaving, setMissionSaving] = useState(false);
  const [deletingMissionId, setDeletingMissionId] = useState<string | null>(null);
```

- [ ] **Step 3: Sync categoryName from loaded missions**

In `loadAdminCustomMissions`, after `setAdminCustomMissions(data.missions)`, add:
```typescript
    if (data.missions.length > 0) setCustomCategoryName(data.missions[0].category_name);
```

- [ ] **Step 4: Add "My Missions" nav button to the games view header**

Find:
```typescript
          <button className="btn btn-primary" onClick={() => setView('create')}>+ NEW GAME</button>
```
Replace with:
```typescript
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { loadAdminCustomMissions(); setView('missions'); }}>✏️ My Missions</button>
            <button className="btn btn-primary" onClick={() => setView('create')}>+ NEW GAME</button>
          </div>
```

- [ ] **Step 5: Add the My Missions view**

Find the line `if (view === 'create') return (` and add the full My Missions view BEFORE it:

```typescript
  if (view === 'missions') {
    async function saveCategoryName() {
      if (!customCategoryName.trim()) return;
      setCategoryNameSaving(true);
      await POST('/api/admin/custom-missions/category', { category_name: customCategoryName.trim() });
      setCategoryNameSaving(false);
      loadAdminCustomMissions();
    }

    function openNewForm() {
      setEditingMissionId(null);
      setMissionForm(EMPTY_FORM);
      setMissionFormError('');
      setShowMissionForm(true);
    }

    function openEditForm(cm: import('@/lib/supabase').CustomMission) {
      setEditingMissionId(cm.id);
      const d = cm.data as Record<string, unknown>;
      setMissionForm({
        name: cm.name,
        icon: cm.icon,
        desc: cm.desc,
        difficulty: cm.difficulty,
        maxPts: cm.max_pts,
        type: cm.type,
        triviaRounds: cm.type === 'trivia_quiz' ? (d.rounds as MissionFormData['triviaRounds']) ?? [] : [],
        statements: cm.type === 'truefalse' ? (d.statements as MissionFormData['statements']) ?? [] : [],
        closestQuestions: cm.type === 'closest_wins'
          ? ((d.questions as { q: string; answer: number; unit: string; hint: string }[]) ?? []).map(q => ({ ...q, answer: String(q.answer) }))
          : [],
        clues: cm.type === 'pa_sparet' ? (d.clues as string[]) ?? [] : [],
        paAnswer: cm.type === 'pa_sparet' ? (d.answer as string) ?? '' : '',
        timelineItems: cm.type === 'timeline'
          ? ((d.items as { label: string; year: number }[]) ?? []).map(i => ({ label: i.label, year: String(i.year) }))
          : [],
        photoPrompt: cm.type === 'photo' ? (d.prompt as string) ?? '' : '',
      });
      setMissionFormError('');
      setShowMissionForm(true);
    }

    async function saveMission() {
      const { validateMissionData, buildMissionData } = await import('@/lib/custom-missions');
      const validationError = validateMissionData(missionForm.type, {
        triviaRounds: missionForm.triviaRounds,
        statements: missionForm.statements,
        closestQuestions: missionForm.closestQuestions,
        clues: missionForm.clues,
        paAnswer: missionForm.paAnswer,
        timelineItems: missionForm.timelineItems,
        photoPrompt: missionForm.photoPrompt,
      });
      if (validationError) { setMissionFormError(validationError); return; }

      setMissionSaving(true);
      setMissionFormError('');
      const data = buildMissionData(missionForm.type, {
        triviaRounds: missionForm.triviaRounds,
        statements: missionForm.statements,
        closestQuestions: missionForm.closestQuestions,
        clues: missionForm.clues,
        paAnswer: missionForm.paAnswer,
        timelineItems: missionForm.timelineItems,
        photoPrompt: missionForm.photoPrompt,
      });
      const payload = {
        category_name: customCategoryName,
        name: missionForm.name.trim(),
        icon: missionForm.icon || '⭐',
        desc: missionForm.desc,
        difficulty: missionForm.difficulty,
        max_pts: missionForm.maxPts,
        type: missionForm.type,
        data,
      };

      if (editingMissionId) {
        await fetch(`/api/admin/custom-missions/${editingMissionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify(payload),
        });
      } else {
        await POST('/api/admin/custom-missions', { ...payload, sort_order: adminCustomMissions.length });
      }
      setMissionSaving(false);
      setShowMissionForm(false);
      setEditingMissionId(null);
      loadAdminCustomMissions();
    }

    async function deleteMission(id: string) {
      setDeletingMissionId(id);
      await fetch(`/api/admin/custom-missions/${id}`, {
        method: 'DELETE',
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
      });
      setDeletingMissionId(null);
      loadAdminCustomMissions();
    }

    const setF = (patch: Partial<MissionFormData>) => setMissionForm(prev => ({ ...prev, ...patch }));
    const inputStyle = { width: '100%', padding: '8px 12px', fontSize: '13px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontFamily: "'Sora', sans-serif" };
    const labelStyle = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--muted)', display: 'block', marginBottom: '4px' };

    return (
      <>
        <nav className="nav">
          <div className="nav-brand"><GameOnLogo size={22} /></div>
          <NavCenter game={null} />
          <div className="nav-right">
            <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onLogout}>LOG OUT</button>
          </div>
        </nav>
        <div className="container fade-in">
          <div style={{ padding: '32px 0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { setView('games'); setShowMissionForm(false); }}>← Back</button>
            <h2 style={{ margin: 0 }}>My Missions</h2>
          </div>

          {/* Category name */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>CATEGORY NAME (shown to teams)</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={customCategoryName}
                onChange={e => setCustomCategoryName(e.target.value)}
                placeholder="e.g. Volvo Cars"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '12px', flexShrink: 0 }}
                disabled={categoryNameSaving || !customCategoryName.trim()}
                onClick={saveCategoryName}
              >
                {categoryNameSaving ? '...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Mission list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {adminCustomMissions.length === 0 && !showMissionForm && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px', fontSize: '14px' }}>
                No missions yet. Add your first one below.
              </div>
            )}
            {adminCustomMissions.map(cm => (
              <div key={cm.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '22px' }}>{cm.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{cm.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{cm.type.replace('_', ' ')} · {cm.difficulty} · {cm.max_pts} pts</div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => openEditForm(cm)}>Edit</button>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--accent3)' }}
                  disabled={deletingMissionId === cm.id}
                  onClick={() => deleteMission(cm.id)}
                >
                  {deletingMissionId === cm.id ? '...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>

          {/* Add / Edit form */}
          {!showMissionForm && (
            <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={openNewForm}>+ Add Mission</button>
          )}

          {showMissionForm && (
            <div className="card" style={{ marginBottom: '32px' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '16px' }}>{editingMissionId ? 'Edit Mission' : 'New Mission'}</h3>

              {/* Base fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>NAME</label>
                  <input type="text" value={missionForm.name} onChange={e => setF({ name: e.target.value })} placeholder="Mission name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>ICON</label>
                  <input type="text" value={missionForm.icon} onChange={e => setF({ icon: e.target.value })} placeholder="⭐" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>DESCRIPTION</label>
                <input type="text" value={missionForm.desc} onChange={e => setF({ desc: e.target.value })} placeholder="What teams see before starting" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>DIFFICULTY</label>
                  <select value={missionForm.difficulty} onChange={e => setF({ difficulty: e.target.value as MissionFormData['difficulty'] })} style={inputStyle}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>MAX PTS</label>
                  <input type="number" value={missionForm.maxPts} min={0} max={9999} step={50} onChange={e => setF({ maxPts: Number(e.target.value) })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>TYPE</label>
                  <select value={missionForm.type} onChange={e => setF({ type: e.target.value })} style={inputStyle}>
                    <option value="">Select type…</option>
                    <option value="trivia_quiz">Trivia Quiz</option>
                    <option value="truefalse">True / False</option>
                    <option value="closest_wins">Closest Wins</option>
                    <option value="pa_sparet">På Spåret</option>
                    <option value="timeline">Timeline</option>
                    <option value="photo">Photo</option>
                  </select>
                </div>
              </div>

              {/* ── Type-specific fields ── */}

              {missionForm.type === 'photo' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>WHAT SHOULD TEAMS PHOTOGRAPH?</label>
                  <input type="text" value={missionForm.photoPrompt} onChange={e => setF({ photoPrompt: e.target.value })} placeholder="e.g. A selfie in front of our logo" style={inputStyle} />
                </div>
              )}

              {missionForm.type === 'pa_sparet' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>CLUES (revealed one at a time, most points for first clue)</label>
                  {missionForm.clues.map((clue, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', alignSelf: 'center', width: '20px', flexShrink: 0 }}>{i + 1}.</span>
                      <input type="text" value={clue} onChange={e => { const c = [...missionForm.clues]; c[i] = e.target.value; setF({ clues: c }); }} placeholder={`Clue ${i + 1}`} style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={() => setF({ clues: missionForm.clues.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px', marginBottom: '10px' }} onClick={() => setF({ clues: [...missionForm.clues, ''] })}>+ Add clue</button>
                  <label style={labelStyle}>ANSWER</label>
                  <input type="text" value={missionForm.paAnswer} onChange={e => setF({ paAnswer: e.target.value })} placeholder="The correct answer" style={inputStyle} />
                </div>
              )}

              {missionForm.type === 'truefalse' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>STATEMENTS</label>
                  {missionForm.statements.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <input type="text" value={s.text} onChange={e => { const arr = [...missionForm.statements]; arr[i] = { ...arr[i], text: e.target.value }; setF({ statements: arr }); }} placeholder="Statement text" style={{ ...inputStyle, flex: 1 }} />
                      <select value={s.answer ? 'true' : 'false'} onChange={e => { const arr = [...missionForm.statements]; arr[i] = { ...arr[i], answer: e.target.value === 'true' }; setF({ statements: arr }); }} style={{ ...inputStyle, width: '90px', flexShrink: 0 }}>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                      <button onClick={() => setF({ statements: missionForm.statements.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setF({ statements: [...missionForm.statements, { text: '', answer: true }] })}>+ Add statement</button>
                </div>
              )}

              {missionForm.type === 'closest_wins' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>QUESTIONS</label>
                  {missionForm.closestQuestions.map((q, i) => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Question {i + 1}</span>
                        <button onClick={() => setF({ closestQuestions: missionForm.closestQuestions.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px' }}>×</button>
                      </div>
                      <input type="text" value={q.q} onChange={e => { const arr = [...missionForm.closestQuestions]; arr[i] = { ...arr[i], q: e.target.value }; setF({ closestQuestions: arr }); }} placeholder="Question" style={{ ...inputStyle, marginBottom: '6px' }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <input type="number" value={q.answer} onChange={e => { const arr = [...missionForm.closestQuestions]; arr[i] = { ...arr[i], answer: e.target.value }; setF({ closestQuestions: arr }); }} placeholder="Correct answer (number)" style={inputStyle} />
                        <input type="text" value={q.unit} onChange={e => { const arr = [...missionForm.closestQuestions]; arr[i] = { ...arr[i], unit: e.target.value }; setF({ closestQuestions: arr }); }} placeholder="Unit (e.g. employees)" style={inputStyle} />
                      </div>
                      <input type="text" value={q.hint} onChange={e => { const arr = [...missionForm.closestQuestions]; arr[i] = { ...arr[i], hint: e.target.value }; setF({ closestQuestions: arr }); }} placeholder="Hint" style={{ ...inputStyle, marginTop: '6px' }} />
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setF({ closestQuestions: [...missionForm.closestQuestions, { q: '', answer: '', unit: '', hint: '' }] })}>+ Add question</button>
                </div>
              )}

              {missionForm.type === 'timeline' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>EVENTS (teams will sort these chronologically)</label>
                  {missionForm.timelineItems.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <input type="text" value={item.label} onChange={e => { const arr = [...missionForm.timelineItems]; arr[i] = { ...arr[i], label: e.target.value }; setF({ timelineItems: arr }); }} placeholder="Event label" style={{ ...inputStyle, flex: 1 }} />
                      <input type="number" value={item.year} onChange={e => { const arr = [...missionForm.timelineItems]; arr[i] = { ...arr[i], year: e.target.value }; setF({ timelineItems: arr }); }} placeholder="Year" style={{ ...inputStyle, width: '90px', flexShrink: 0 }} />
                      <button onClick={() => setF({ timelineItems: missionForm.timelineItems.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setF({ timelineItems: [...missionForm.timelineItems, { label: '', year: '' }] })}>+ Add event</button>
                </div>
              )}

              {missionForm.type === 'trivia_quiz' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>QUESTIONS</label>
                  {missionForm.triviaRounds.map((round, i) => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Question {i + 1}</span>
                        <button onClick={() => setF({ triviaRounds: missionForm.triviaRounds.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px' }}>×</button>
                      </div>
                      <input type="text" value={round.question} onChange={e => { const arr = [...missionForm.triviaRounds]; arr[i] = { ...arr[i], question: e.target.value }; setF({ triviaRounds: arr }); }} placeholder="Question" style={{ ...inputStyle, marginBottom: '8px' }} />
                      {([0, 1, 2, 3] as const).map(oi => (
                        <div key={oi} style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'center' }}>
                          <input
                            type="radio"
                            name={`correct-${i}`}
                            checked={round.answer === round.options[oi]}
                            onChange={() => { const arr = [...missionForm.triviaRounds]; arr[i] = { ...arr[i], answer: arr[i].options[oi] }; setF({ triviaRounds: arr }); }}
                            style={{ flexShrink: 0 }}
                          />
                          <input
                            type="text"
                            value={round.options[oi] ?? ''}
                            onChange={e => {
                              const arr = [...missionForm.triviaRounds];
                              const opts: [string, string, string, string] = [...arr[i].options] as [string, string, string, string];
                              opts[oi] = e.target.value;
                              const newAnswer = arr[i].answer === arr[i].options[oi] ? e.target.value : arr[i].answer;
                              arr[i] = { ...arr[i], options: opts, answer: newAnswer };
                              setF({ triviaRounds: arr });
                            }}
                            placeholder={`Option ${oi + 1}`}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                        </div>
                      ))}
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>Select the radio button next to the correct option</div>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setF({ triviaRounds: [...missionForm.triviaRounds, { question: '', options: ['', '', '', ''], answer: '' }] })}>+ Add question</button>
                </div>
              )}

              {missionFormError && (
                <p style={{ color: 'var(--accent3)', fontSize: '13px', marginBottom: '12px' }}>{missionFormError}</p>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }} disabled={missionSaving || !missionForm.name.trim() || !missionForm.type} onClick={saveMission}>
                  {missionSaving ? 'Saving…' : editingMissionId ? 'Save Changes' : 'Add Mission'}
                </button>
                <button className="btn btn-ghost" style={{ padding: '10px 16px' }} onClick={() => { setShowMissionForm(false); setEditingMissionId(null); setMissionFormError(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -30
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add My Missions view to AdminScreen with full CRUD form"
```

---

## Task 10: Build Check + Deploy

- [ ] **Step 1: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -40
```
Expected: no errors.

- [ ] **Step 2: Deploy**

```bash
npx vercel deploy --prod 2>&1 | tail -10
```
Expected: deployment ready.

- [ ] **Step 3: Smoke test**

1. Open the app → Admin → log in
2. Click "✏️ My Missions" → set category name "Test Company" → Save
3. Add a Trivia mission with 2 questions → Add Mission → verify it appears in the list
4. Go back → New Game → verify "TEST COMPANY" appears in the mission picker with your mission
5. Create the game, include the custom mission
6. Open in a new tab as a team → log in → verify the "Test Company" category appears in missions
7. Select the custom trivia mission → verify it plays correctly
8. Delete the test mission from My Missions
