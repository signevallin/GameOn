# Soft-Delete Games Included in Analytics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Games deleted after this feature is deployed are soft-deleted (invisible to UI, preserved in DB) so they continue to appear in both the superadmin and personal admin analytics views.

**Architecture:** Add `deleted_at` and `teams_count` columns to the `games` table. The delete endpoint snapshots the team count and sets `deleted_at` instead of hard-deleting the game row. All live-game queries gain a `.is('deleted_at', null)` filter. Analytics queries omit that filter and use the stored `teams_count` snapshot for deleted games (since their teams rows are hard-deleted).

**Tech Stack:** Next.js 14 App Router, Supabase (service-role client), TypeScript, React

---

## File Map

| File | What changes |
|------|-------------|
| `supabase/migrations/20260611_soft_delete_games.sql` | New — adds `deleted_at` and `teams_count` columns |
| `lib/supabase.ts` | Adds `deleted_at?: string \| null` to `Game` type |
| `app/api/admin/game/route.ts` | Soft delete; `includeDeleted` param; `teams_count` normalization; list filters |
| `app/api/game/route.ts` | Filter deleted from game_key lookups |
| `app/api/team/login/route.ts` | Filter deleted from game lookup |
| `app/api/poll/route.ts` | Filter deleted from game poll |
| `app/api/present/[gameKey]/route.ts` | Filter deleted from presenter lookup |
| `app/api/admin/superadmin/analytics/route.ts` | Include deleted-game `teams_count` in KPIs and per-customer stats |
| `components/screens/AdminScreen.tsx` | `analyticsGames` state; `loadAnalyticsGames()`; analytics view reads from it |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260611_soft_delete_games.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260611_soft_delete_games.sql
alter table public.games
  add column if not exists deleted_at timestamptz,
  add column if not exists teams_count integer not null default 0;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

The project runs on Vercel + Supabase cloud (Docker is not available locally). Apply the migration directly using the Supabase MCP tool:

```
Tool: mcp__7c6fd78e-cf44-4142-ab14-299b0616e1e6__apply_migration
project_id: rbkpcnzrimicwzqwvgub
name: soft_delete_games
query: (contents of the migration file above)
```

- [ ] **Step 3: Verify columns exist**

```
Tool: mcp__7c6fd78e-cf44-4142-ab14-299b0616e1e6__execute_sql
project_id: rbkpcnzrimicwzqwvgub
query: select column_name, data_type, is_nullable, column_default
       from information_schema.columns
       where table_name = 'games'
         and column_name in ('deleted_at', 'teams_count')
       order by column_name;
```

Expected: two rows — `deleted_at` (timestamp with time zone, YES nullable) and `teams_count` (integer, NO, default 0).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260611_soft_delete_games.sql
git commit -m "feat(db): add deleted_at and teams_count columns to games"
```

---

## Task 2: Type update + Admin game API (soft delete + list filter + includeDeleted)

**Files:**
- Modify: `lib/supabase.ts` (Game type, line 37–65)
- Modify: `app/api/admin/game/route.ts` (full file — GET, POST list, POST delete)

- [ ] **Step 1: Add `deleted_at` to the `Game` type in `lib/supabase.ts`**

Current Game type ends around line 65. Add one field after `teams_count`:

```typescript
export type Game = {
  id: string;
  game_key: string;
  name: string;
  missions: string[];
  duration_minutes: number;
  status: 'draft' | 'active' | 'finished';
  started_at: string | null;
  created_at: string;
  mission_max_pts: Record<string, number>;
  hide_leaderboard?: boolean;
  ai_photo_rating?: boolean;
  ai_photo_instructions?: string | null;
  user_id?: string;
  powerups_used?: string[];
  hot_potato?: {
    mission_id: string;
    expires_at: string;
    penalty_pts: number;
    game_id: string;
  } | null;
  mystery_box?: {
    created_at: string;
    expires_at: string;
    claimed_by: string | null;
  } | null;
  remote_mode?: boolean;
  teams_count?: number;
  deleted_at?: string | null;
};
```

- [ ] **Step 2: Replace the entire `app/api/admin/game/route.ts`**

Key changes versus current file:
- GET: skip `deleted_at IS NULL` filter when `?includeDeleted=true`; use snapshot `teams_count` for deleted games
- POST `action === 'list'`: same filter logic
- POST `action === 'delete'`: snapshot team count → soft-delete game → hard-delete teams + photos

```typescript
// app/api/admin/game/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function generateKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';
  for (let i = 0; i < 6; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Normalize the Supabase teams(count) join into a flat teams_count number.
 *  For soft-deleted games the teams rows are gone, so we fall back to the
 *  stored teams_count snapshot on the game row itself. */
function normalizeTeamsCount(g: Record<string, unknown>): number {
  if (g.deleted_at) return (g.teams_count as number | null) ?? 0;
  return (g.teams as { count: number }[] | null)?.[0]?.count ?? 0;
}

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const url = new URL(req.url);
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

  let query = adminClient().from('games').select('*, teams(count)').order('created_at', { ascending: false });
  if (!admin.isSuperAdmin) query = query.eq('user_id', admin.userId);
  if (!includeDeleted) query = query.is('deleted_at', null);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const normalized = (data ?? []).map(g => ({
    ...g,
    teams_count: normalizeTeamsCount(g as Record<string, unknown>),
    teams: undefined,
  }));

  return NextResponse.json({ games: normalized }, { headers: { 'Cache-Control': 'no-store, no-cache' } });
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const body = await req.json();

  if (body.action === 'list') {
    const includeDeleted = body.includeDeleted === true;

    let query = adminClient().from('games').select('*, teams(count)').order('created_at', { ascending: false });
    if (!admin.isSuperAdmin) query = query.eq('user_id', admin.userId);
    if (!includeDeleted) query = query.is('deleted_at', null);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const normalized = (data ?? []).map(g => ({
      ...g,
      teams_count: normalizeTeamsCount(g as Record<string, unknown>),
      teams: undefined,
    }));
    return NextResponse.json({ games: normalized });
  }

  if (body.action === 'delete') {
    const { gameId } = body;
    if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

    // Verify ownership
    const { data: game } = await adminClient().from('games').select('user_id').eq('id', gameId).single();
    if (!game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    if (!admin.isSuperAdmin && game.user_id !== admin.userId) return unauthorizedResponse();

    // Snapshot team count before deleting teams
    const { count: teamsCount } = await adminClient()
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId);

    // Soft-delete the game (preserve row for analytics)
    const { error: softDeleteErr } = await adminClient()
      .from('games')
      .update({ deleted_at: new Date().toISOString(), teams_count: teamsCount ?? 0 })
      .eq('id', gameId);
    if (softDeleteErr) return NextResponse.json({ error: softDeleteErr.message }, { status: 500 });

    // Hard-delete teams and photos (data no longer needed)
    const { data: gameTeams } = await adminClient().from('teams').select('id').eq('game_id', gameId);
    const teamIds = (gameTeams ?? []).map((t: { id: string }) => t.id);
    if (teamIds.length) {
      await adminClient().from('photo_submissions').delete().in('team_id', teamIds);
    }
    await adminClient().from('teams').delete().eq('game_id', gameId);

    return NextResponse.json({ ok: true });
  }

  // Create game
  const { name, missions, duration_minutes, mission_max_pts, hide_leaderboard, ai_photo_rating, ai_photo_instructions, language, remote_mode } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'Enter a game name.' }, { status: 400 });
  if (!missions?.length) return NextResponse.json({ error: 'Select at least one mission.' }, { status: 400 });

  let key = '';
  let attempts = 0;
  while (attempts < 10) {
    key = generateKey();
    const { data: existing } = await adminClient().from('games').select('id').eq('game_key', key).single();
    if (!existing) break;
    attempts++;
  }

  const { data: newGame, error } = await adminClient()
    .from('games')
    .insert({
      game_key: key,
      name: name.trim(),
      missions,
      duration_minutes: duration_minutes ?? 45,
      mission_max_pts: mission_max_pts ?? {},
      hide_leaderboard: hide_leaderboard ?? false,
      ai_photo_rating: ai_photo_rating ?? false,
      ai_photo_instructions: ai_photo_instructions ?? null,
      language: language ?? 'en',
      status: 'draft',
      user_id: admin.userId,
      powerups_used: [],
      remote_mode: remote_mode ?? false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ game: newGame });
}
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
git add lib/supabase.ts app/api/admin/game/route.ts
git commit -m "feat(api): soft delete games, includeDeleted param, teams_count snapshot"
```

---

## Task 3: Filter deleted games from live game flows

**Files:**
- Modify: `app/api/game/route.ts` (lines 20 and 32)
- Modify: `app/api/team/login/route.ts` (line 23–26)
- Modify: `app/api/poll/route.ts` (line 49)
- Modify: `app/api/present/[gameKey]/route.ts` (line 21–25)

These are all the endpoints a team member or presenter hits using a `game_key`. A soft-deleted game should respond "not found" on all of them.

- [ ] **Step 1: `app/api/game/route.ts` — filter deleted from GET and POST**

In the GET handler (around line 19–21), change:
```typescript
const { data, error } = await getSupabase()
  .from('games').select('*').eq('game_key', key).single();
```
To:
```typescript
const { data, error } = await getSupabase()
  .from('games').select('*').eq('game_key', key).is('deleted_at', null).single();
```

In the POST handler (around line 31–33), change:
```typescript
const { data, error } = await getSupabase()
  .from('games').select('*').eq('game_key', key.toUpperCase()).single();
```
To:
```typescript
const { data, error } = await getSupabase()
  .from('games').select('*').eq('game_key', key.toUpperCase()).is('deleted_at', null).single();
```

- [ ] **Step 2: `app/api/team/login/route.ts` — filter deleted from game lookup**

Around line 22–26, change:
```typescript
const { data: game, error: gameErr } = await supabase
  .from('games')
  .select('*')
  .eq('game_key', gameKey.toUpperCase())
  .single();
```
To:
```typescript
const { data: game, error: gameErr } = await supabase
  .from('games')
  .select('*')
  .eq('game_key', gameKey.toUpperCase())
  .is('deleted_at', null)
  .single();
```

- [ ] **Step 3: `app/api/poll/route.ts` — filter deleted from game poll**

Around line 49, change:
```typescript
supabase.from('games').select('*').eq('game_key', gameKey.toUpperCase()).single(),
```
To:
```typescript
supabase.from('games').select('*').eq('game_key', gameKey.toUpperCase()).is('deleted_at', null).single(),
```

- [ ] **Step 4: `app/api/present/[gameKey]/route.ts` — filter deleted from presenter**

Around line 21–25, change:
```typescript
const { data: game, error: gameErr } = await supabase
  .from('games')
  .select('id, name, status, started_at, duration_minutes, language')
  .eq('game_key', gameKey)
  .single();
```
To:
```typescript
const { data: game, error: gameErr } = await supabase
  .from('games')
  .select('id, name, status, started_at, duration_minutes, language')
  .eq('game_key', gameKey)
  .is('deleted_at', null)
  .single();
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add app/api/game/route.ts app/api/team/login/route.ts app/api/poll/route.ts app/api/present/\[gameKey\]/route.ts
git commit -m "fix(api): filter soft-deleted games from all live game flows"
```

---

## Task 4: Superadmin analytics — include deleted games' team counts

**Files:**
- Modify: `app/api/admin/superadmin/analytics/route.ts`

The games query currently selects `id, name, user_id, status, started_at, missions`. It has no `deleted_at` filter, so soft-deleted games are already returned. We need to:
1. Also select `deleted_at` and `teams_count` from the games query
2. Use the stored `teams_count` snapshot (not the teams-join) for deleted games in all team-count computations

- [ ] **Step 1: Add `deleted_at` and `teams_count` to the games select**

Around line 81–83, change:
```typescript
supabase
  .from('games')
  .select('id, name, user_id, status, started_at, missions')
  .order('started_at', { ascending: false }),
```
To:
```typescript
supabase
  .from('games')
  .select('id, name, user_id, status, started_at, missions, deleted_at, teams_count')
  .order('started_at', { ascending: false }),
```

- [ ] **Step 2: Fix the KPI team-count totals (lines ~146–157)**

The current code uses `teams.length` as total team count. For deleted games, their teams are gone from the `teams` table. Add the snapshot counts for deleted games.

Change:
```typescript
const totalTeamCount = teams.length;
const avgTeamsPerGame = games.length > 0 ? totalTeamCount / games.length : 0;
```
To:
```typescript
const deletedTeamCount = games
  .filter(g => g.deleted_at)
  .reduce((sum, g) => sum + ((g as unknown as { teams_count?: number }).teams_count ?? 0), 0);
const totalTeamCount = teams.length + deletedTeamCount;
const avgTeamsPerGame = games.length > 0 ? totalTeamCount / games.length : 0;
```

- [ ] **Step 3: Fix per-game team count and topScore in the customers section (lines ~171–181)**

Change:
```typescript
const userGameDetails: AnalyticsGame[] = userGames.map(g => {
  const gt = teamsByGame[g.id] ?? [];
  const topScore = gt.length > 0 ? Math.max(...gt.map(t => t.score)) : 0;
  return {
    id: g.id,
    name: g.name,
    teamCount: gt.length,
    topScore,
    finished: g.status === 'finished',
    startedAt: g.started_at ?? null,
  };
});
```
To:
```typescript
const userGameDetails: AnalyticsGame[] = userGames.map(g => {
  const isDeleted = !!(g as unknown as { deleted_at?: string | null }).deleted_at;
  const gt = isDeleted ? [] : (teamsByGame[g.id] ?? []);
  const teamCount = isDeleted
    ? ((g as unknown as { teams_count?: number }).teams_count ?? 0)
    : gt.length;
  const topScore = gt.length > 0 ? Math.max(...gt.map(t => t.score)) : 0;
  return {
    id: g.id,
    name: g.name,
    teamCount,
    topScore,
    finished: g.status === 'finished',
    startedAt: g.started_at ?? null,
  };
});
```

- [ ] **Step 4: Fix per-user avgTeams calculation (line ~185)**

Change:
```typescript
const totalTeamsForUser = userGames.reduce((sum, g) => sum + (teamsByGame[g.id]?.length ?? 0), 0);
```
To:
```typescript
const totalTeamsForUser = userGames.reduce((sum, g) => {
  const isDeleted = !!(g as unknown as { deleted_at?: string | null }).deleted_at;
  if (isDeleted) return sum + ((g as unknown as { teams_count?: number }).teams_count ?? 0);
  return sum + (teamsByGame[g.id]?.length ?? 0);
}, 0);
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/superadmin/analytics/route.ts
git commit -m "feat(analytics): include soft-deleted games in superadmin analytics"
```

---

## Task 5: Personal analytics — load all games including deleted

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

The `my-analytics` view currently reads from the `games` state (live games only). We add a separate `analyticsGames` state that includes deleted games, loaded on demand when the analytics view opens.

- [ ] **Step 1: Add `analyticsGames` state near the existing `games` state (around line 456)**

Find:
```typescript
const [games, setGames] = useState<Game[]>([]);
```
Add directly after it:
```typescript
const [analyticsGames, setAnalyticsGames] = useState<Game[]>([]);
```

- [ ] **Step 2: Add `loadAnalyticsGames` function after `loadGames` (around line 625)**

Find:
```typescript
  }, [POST]);
```
(the closing of `loadGames`). Add the new loader immediately after:
```typescript
  const loadAnalyticsGames = useCallback(async () => {
    const res = await fetch('/api/admin/game?includeDeleted=true', {
      headers: { Authorization: `Bearer ${authToken}` },
      cache: 'no-store',
    });
    const data = await res.json();
    if (data.games) setAnalyticsGames(data.games);
  }, [authToken]);
```

Note: `loadAnalyticsGames` uses `fetch` directly with `?includeDeleted=true` (a GET query param) because the existing `POST` helper always sends a POST request. `authToken` is already available in scope — it's the same token used by the `POST` helper.

- [ ] **Step 3: Auto-load analytics games when opening the analytics view**

Find the `useEffect` that loads games on mount (around line 657):
```typescript
  useEffect(() => { loadGames(); }, [loadGames]);
```
Add a new effect after it:
```typescript
  useEffect(() => {
    if (view === 'my-analytics' && analyticsGames.length === 0) {
      loadAnalyticsGames();
    }
  }, [view, analyticsGames.length, loadAnalyticsGames]);
```

- [ ] **Step 4: Replace `games` with `analyticsGames` in the `my-analytics` render block**

The `view === 'my-analytics'` block starts around line 1785. It references `games` in five places:

1. Line 1806: `const totalGames = games.length;`
2. Line 1807: `const finishedCount = games.filter(...`
3. Line 1809: `const totalTeams = games.reduce(...`
4. Line 1821: `games.forEach(g => {`
5. Line 1830: `const recentGames = [...games]`

Replace all five occurrences of `games` with `analyticsGames` **only within the `if (view === 'my-analytics')` block** (lines 1785–1938). Do not touch other occurrences of `games` outside that block.

After the change, the block should start with:
```typescript
  if (view === 'my-analytics') {
    // ... helper functions ...
    const totalGames = analyticsGames.length;
    const finishedCount = analyticsGames.filter(g => g.status === 'finished').length;
    const completionRate = totalGames > 0 ? Math.round(finishedCount / totalGames * 100) : 0;
    const totalTeams = analyticsGames.reduce((sum, g) => sum + (g.teams_count ?? 0), 0);
    const avgTeams = totalGames > 0 ? (totalTeams / totalGames).toFixed(1) : '—';

    const gamesPerWeek: { label: string; key: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const key = isoWeekKey(d);
      const weekNum = parseInt(key.split('-')[1]);
      gamesPerWeek.push({ label: `V${weekNum}`, key, count: 0 });
    }
    analyticsGames.forEach(g => {
      if (!g.started_at) return;
      const key = isoWeekKey(new Date(g.started_at));
      const entry = gamesPerWeek.find(e => e.key === key);
      if (entry) entry.count++;
    });
    // ...
    const recentGames = [...analyticsGames]
      .filter(g => g.started_at)
      .sort((a, b) => new Date(b.started_at!).getTime() - new Date(a.started_at!).getTime())
      .slice(0, 5);
```

- [ ] **Step 5: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 6: Run a production build to confirm no compilation errors**

```bash
npm run build
```

Expected: `✓ Compiled successfully` with exit code 0.

- [ ] **Step 7: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat(analytics): personal analytics includes soft-deleted games"
```

---

## Manual Verification Checklist

After all tasks are done, test these flows in the running app:

1. **Delete a game that has teams** — go to admin game list, delete a game. Confirm it disappears from the list.
2. **Personal analytics shows deleted game** — open 📊 Analytics from the profile dropdown. Confirm:
   - "Spel totalt" count includes the deleted game
   - "Lag totalt" and "Snitt lag/spel" reflect the teams that were in the deleted game
   - The deleted game appears in "Senaste spel" if it was recently started
3. **Superadmin analytics shows deleted game** — log in as superadmin, open the analytics view. Confirm team counts include the deleted game's teams.
4. **Old QR code for deleted game shows error** — try joining with the deleted game's key (via `/play?key=…`). Confirm "Wrong game key" error.
5. **New game creation works** — create a new game after the feature is deployed. Confirm normal flow is unaffected.
