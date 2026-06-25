# Soft-Delete Games Included in Analytics — Design Spec

## Goal

Games that are deleted after this feature is deployed should still appear in analytics — both for the superadmin analytics view and the personal admin analytics view — while remaining invisible in all live game flows (game list, team join, polling, presenter screen).

Only games deleted *after* deployment are preserved. Already-deleted games are gone.

---

## Database Changes

Two new columns on the `games` table:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `deleted_at` | `timestamptz` | `NULL` | `NULL` = live game. Timestamp = soft-deleted. |
| `teams_count` | `integer` | `0` | Snapshot of team count stored at deletion time. Needed because teams are hard-deleted. |

Migration file: `supabase/migrations/20260611_soft_delete_games.sql`

```sql
alter table public.games
  add column if not exists deleted_at timestamptz,
  add column if not exists teams_count integer not null default 0;
```

---

## Delete Flow (`app/api/admin/game/route.ts`)

Replace hard delete with soft delete:

**Before:**
```typescript
await adminClient().from('teams').delete().eq('game_id', gameId);
await adminClient().from('games').delete().eq('id', gameId);
```

**After:**
1. Fetch current team count from `teams` table: `select('count', { count: 'exact', head: true })`
2. `UPDATE games SET deleted_at = now(), teams_count = <count> WHERE id = ?`
3. Hard-delete teams (unchanged)
4. Hard-delete photo_submissions (unchanged)

The game row is preserved but invisible to all non-analytics queries.

---

## Filtering Deleted Games from Live Flows

Add `.is('deleted_at', null)` to all game lookups that should only see live games:

| File | Query location |
|------|----------------|
| `app/api/admin/game/route.ts` | GET list and `action === 'list'` |
| `app/api/game/route.ts` | Both game_key lookups |
| `app/api/team/login/route.ts` | Game lookup by game_key |
| `app/api/poll/route.ts` | Game lookup by game_key |
| `app/api/present/[gameKey]/route.ts` | Game lookup by game_key |

---

## Analytics: Including Deleted Games

### Superadmin Analytics (`app/api/admin/superadmin/analytics/route.ts`)

The existing games query has no filter, so deleted games are already returned. Changes needed:

- **`teams_count` per game:** For live games, use the existing teams-join computation (aggregate from `teamsResult`). For deleted games (`g.deleted_at` is non-null), use `g.teams_count` (the stored snapshot).
- **`topScore` for deleted games:** `0` — teams are hard-deleted, scores are gone. Acceptable.
- **`finished`:** Derived from `g.status === 'finished'` — already game-level data, no change needed.
- **KPIs (`totalTeams`, `avgTeamsPerGame`):** Include deleted games' `teams_count` snapshots in the sum.

Implementation: when building per-game stats in the existing JS reduce loop, branch on `g.deleted_at`:
```typescript
const teamCount = g.deleted_at
  ? (g.teams_count ?? 0)
  : teamsByGame[g.id]?.length ?? 0;
```

### Personal Analytics (`components/screens/AdminScreen.tsx`)

The `games` state (used by the game list UI) must remain live-only. Add a parallel state for analytics:

- **New state:** `const [analyticsGames, setAnalyticsGames] = useState<Game[]>([])`
- **New loader:** `loadAnalyticsGames()` — calls `GET /api/admin/game?includeDeleted=true`, stores result in `analyticsGames`
- **Trigger:** When `view` changes to `'my-analytics'` and `analyticsGames` is empty, call `loadAnalyticsGames()`
- **Analytics render block:** Replace all references to `games` with `analyticsGames` in the `view === 'my-analytics'` block

### Admin Game API — `includeDeleted` parameter

`GET /api/admin/game?includeDeleted=true` skips the `.is('deleted_at', null)` filter and adjusts `teams_count` normalization:

```typescript
const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
let query = adminClient().from('games').select('*, teams(count)').order('created_at', { ascending: false });
if (!includeDeleted) query = query.is('deleted_at', null);

// Normalization:
teams_count: g.deleted_at
  ? (g.teams_count ?? 0)
  : (g.teams as { count: number }[] | null)?.[0]?.count ?? 0
```

---

## Type Changes (`lib/supabase.ts`)

Add to the `Game` type:
```typescript
deleted_at?: string | null;
teams_count?: number;  // already present — ensure it stays
```

---

## Out of Scope

- Recovering / un-deleting soft-deleted games
- Showing deleted games in the game list UI (they remain hidden)
- Preserving team-level data (scores, individual completions) for deleted games
- Games deleted before this feature is deployed
