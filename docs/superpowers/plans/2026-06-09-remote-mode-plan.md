# Remote / Distributed Team Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable global/distributed teams to play GameOn with each member on their own device, sharing a team score, real-time mission portal, and live presence indicators.

**Architecture:** All new logic is gated behind `game.remote_mode`. The existing 5-second poll (`/api/poll`) is extended to return team members with online status. A new `/api/team/heartbeat` route updates `last_seen_at` every 30 s per member. Classic mode is completely unaffected.

**Tech Stack:** Next.js App Router, Supabase (service-role client), TypeScript, React

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `lib/supabase.ts` | Modify | Add `remote_mode` to `Game`, `join_code`/`members` to `Team`, add `TeamMember` type |
| `app/api/admin/game/route.ts` | Modify | Accept `remote_mode` boolean in game creation |
| `app/api/team/login/route.ts` | Modify | Remote mode join: `joinCode` + `memberName`, create `team_members` row |
| `app/api/team/heartbeat/route.ts` | Create | New route — update `last_seen_at` for a member |
| `app/api/poll/route.ts` | Modify | Include `members` array (with online status) when team has `join_code` |
| `app/api/admin/teams/route.ts` | Modify | Include `members` per team in both GET and POST handlers |
| `components/screens/LoginScreen.tsx` | Modify | Two-step form — detect remote mode, show extra fields |
| `app/play/page.tsx` | Modify | `memberId`/`memberName` state, heartbeat interval, persist `gameon_member`, pass `members` down |
| `components/screens/MissionsScreen.tsx` | Modify | Accept `memberId` + `members` props, render online member bar |
| `components/screens/AdminScreen.tsx` | Modify | Remote mode toggle in create form, expandable team cards in leaderboard |

---

## Task 1: Update TypeScript types

**Files:**
- Modify: `lib/supabase.ts`

- [ ] **Step 1: Add `remote_mode` to `Game`, `join_code` + `members` to `Team`, add `TeamMember` type**

Open `lib/supabase.ts`. Make these three additions:

**In the `Team` type**, add two optional fields after `extra_powerups`:
```typescript
  join_code?: string | null;
  members?: Array<{ id: string; name: string; online: boolean }>;
```

**In the `Game` type**, add after `mystery_box`:
```typescript
  remote_mode?: boolean;
```

**After the `CustomMission` type**, add:
```typescript
export type TeamMember = {
  id: string;
  team_id: string;
  name: string;
  last_seen_at: string;
  created_at: string;
};
```

The final `lib/supabase.ts` should look like:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Team = {
  id: string;
  name: string;
  score: number;
  completed: string[];
  game_id: string;
  created_at: string;
  finished_at: string | null;
  mission_scores: Record<string, number>;
  pending_notification: { type: string; message?: string; msgKey?: string; params?: Record<string, unknown> } | null;
  double_points: boolean;
  active_effects: {
    freeze_until?: string;
    shield_until?: string;
    double_trouble_remaining?: number;
    double_trouble_missions?: string[];
  };
  team_powerups_used: string[];
  mission_answers: Record<string, string>;
  powerups_received: number;
  extra_powerups: string[];
  join_code?: string | null;
  members?: Array<{ id: string; name: string; online: boolean }>;
};

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
};

export type CustomMission = {
  id: string;
  user_id: string;
  category_name: string;
  category_id: string | null;
  name: string;
  icon: string;
  desc: string;
  difficulty: 'easy' | 'medium' | 'hard';
  max_pts: number;
  type: string;
  data: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  active_from?: string | null;
  active_until?: string | null;
};

export type TeamMember = {
  id: string;
  team_id: string;
  name: string;
  last_seen_at: string;
  created_at: string;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (or only pre-existing errors unrelated to these changes).

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat(remote-mode): add remote_mode/join_code/members to TS types"
```

---

## Task 2: Apply DB migration

**Files:**
- No code files — SQL applied directly via Supabase MCP

- [ ] **Step 1: Run the migration SQL**

Apply each statement in order via Supabase MCP `execute_sql`:

```sql
-- 1. Add remote_mode to games
ALTER TABLE games ADD COLUMN IF NOT EXISTS remote_mode BOOLEAN NOT NULL DEFAULT false;

-- 2. Add join_code to teams (nullable, for remote mode only)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS join_code TEXT;

-- 3. Create team_members table
CREATE TABLE IF NOT EXISTS team_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Index for fast member lookups by team
CREATE INDEX IF NOT EXISTS team_members_team_id_idx ON team_members(team_id);

-- 5. Enable RLS with no policies (server-side service-role access only)
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: Verify tables exist**

Run via Supabase MCP:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'remote_mode';
SELECT column_name FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'join_code';
SELECT table_name FROM information_schema.tables WHERE table_name = 'team_members';
```

Expected: each query returns one row.

- [ ] **Step 3: Commit migration note**

```bash
git commit --allow-empty -m "feat(remote-mode): apply DB migration (games.remote_mode, teams.join_code, team_members table)"
```

---

## Task 3: Extend `POST /api/admin/game` to accept `remote_mode`

**Files:**
- Modify: `app/api/admin/game/route.ts`

- [ ] **Step 1: Extract `remote_mode` from request body and add to insert**

In `app/api/admin/game/route.ts`, locate the "Create game" section (line ~68). Change:

```typescript
  const { name, missions, duration_minutes, mission_max_pts, hide_leaderboard, ai_photo_rating, ai_photo_instructions, language } = body;
```

to:

```typescript
  const { name, missions, duration_minutes, mission_max_pts, hide_leaderboard, ai_photo_rating, ai_photo_instructions, language, remote_mode } = body;
```

Then in the `.insert({...})` call, add `remote_mode: remote_mode ?? false,` after `powerups_used: [],`:

```typescript
  const { data: game, error } = await adminClient()
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
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/game/route.ts
git commit -m "feat(remote-mode): accept remote_mode in game creation API"
```

---

## Task 4: Extend `POST /api/team/login` for remote mode join

**Files:**
- Modify: `app/api/team/login/route.ts`

- [ ] **Step 1: Replace the route body with remote-mode-aware version**

Replace the full contents of `app/api/team/login/route.ts` with:

```typescript
// app/api/team/login/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { translateMission } from '@/lib/translate';

export const dynamic = 'force-dynamic';

const MEMBER_CAP = 20;

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { name, gameKey, joinCode, memberName } = await req.json();

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
  const customMissionsPromise = game.user_id
    ? (() => {
        const nowIso = new Date().toISOString();
        return supabase
          .from('custom_missions')
          .select('*')
          .eq('user_id', game.user_id)
          .or(`active_from.is.null,active_from.lte.${nowIso}`)
          .or(`active_until.is.null,active_until.gte.${nowIso}`)
          .order('sort_order')
          .order('created_at');
      })()
    : Promise.resolve({ data: [] });

  // ── REMOTE MODE ──────────────────────────────────────────────────────────────
  if (game.remote_mode) {
    if (!memberName?.trim()) {
      return NextResponse.json({ error: 'Enter your name.' }, { status: 400 });
    }
    if (!joinCode?.trim()) {
      return NextResponse.json({ error: 'Enter the team code.' }, { status: 400 });
    }

    const [teamResult, customMissionsResult] = await Promise.all([
      supabase
        .from('teams')
        .select('*')
        .eq('game_id', game.id)
        .eq('name', name.trim())
        .eq('join_code', joinCode.trim().toUpperCase())
        .single(),
      customMissionsPromise,
    ]);

    let customMissions = customMissionsResult.data ?? [];
    if (customMissions.length > 0 && game.language && game.language !== 'en') {
      customMissions = await Promise.all(
        customMissions.map(async (m: { id: string; name: string; desc: string; [key: string]: unknown }) => {
          const translated = await translateMission(m.id, game.language as string, m.name, m.desc ?? '', supabase);
          return { ...m, name: translated.name, desc: translated.desc };
        })
      );
    }

    let team = teamResult.data;

    if (!team) {
      // Team name + code combo not found — could mean name/code mismatch on existing team,
      // or brand new team. Check if a team with that name already exists (wrong code).
      const { data: existingByName } = await supabase
        .from('teams')
        .select('id')
        .eq('game_id', game.id)
        .eq('name', name.trim())
        .single();

      if (existingByName) {
        // Team name exists but join_code doesn't match
        return NextResponse.json(
          { error: "Team code or name doesn't match. Check with your team." },
          { status: 404 }
        );
      }

      // ── Enforce free-plan team limit ────────────────────────────────────────
      if (game.user_id) {
        const { getSubscription } = await import('@/lib/subscription');
        const sub = await getSubscription(game.user_id);
        if (sub.plan === 'free') {
          const { count } = await supabase
            .from('teams')
            .select('id', { count: 'exact', head: true })
            .eq('game_id', game.id);
          if ((count ?? 0) >= 5) {
            return NextResponse.json(
              { error: 'This game has reached the 5-team limit on the free plan. The organiser needs to upgrade to Pro.' },
              { status: 403 }
            );
          }
        }
      }

      // Create new team with join_code
      const { data: newTeam, error: teamErr } = await supabase
        .from('teams')
        .insert({ name: name.trim(), game_id: game.id, score: 0, completed: [], join_code: joinCode.trim().toUpperCase() })
        .select()
        .single();

      if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });
      team = newTeam;
    }

    // Check member cap
    const { count: memberCount } = await supabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', team.id);

    if ((memberCount ?? 0) >= MEMBER_CAP) {
      return NextResponse.json({ error: 'Team is full.' }, { status: 409 });
    }

    // Create team_members row
    const { data: member, error: memberErr } = await supabase
      .from('team_members')
      .insert({ team_id: team.id, name: memberName.trim() })
      .select()
      .single();

    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

    return NextResponse.json({
      team,
      memberId: member.id,
      memberName: member.name,
      game,
      customMissions,
    });
  }

  // ── CLASSIC MODE (unchanged) ─────────────────────────────────────────────────
  const [teamResult, customMissionsResult] = await Promise.all([
    supabase.from('teams').select('*').eq('name', name.trim()).eq('game_id', game.id).single(),
    customMissionsPromise,
  ]);

  let customMissions = customMissionsResult.data ?? [];
  if (customMissions.length > 0 && game.language && game.language !== 'en') {
    customMissions = await Promise.all(
      customMissions.map(async (m: { id: string; name: string; desc: string; [key: string]: unknown }) => {
        const translated = await translateMission(m.id, game.language as string, m.name, m.desc ?? '', supabase);
        return { ...m, name: translated.name, desc: translated.desc };
      })
    );
  }

  if (teamResult.data) {
    return NextResponse.json({ team: teamResult.data, game, customMissions });
  }

  // ── Enforce free-plan team limit ────────────────────────────────────────────
  if (game.user_id) {
    const { getSubscription } = await import('@/lib/subscription');
    const sub = await getSubscription(game.user_id);
    if (sub.plan === 'free') {
      const { count } = await supabase
        .from('teams')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', game.id);
      if ((count ?? 0) >= 5) {
        return NextResponse.json(
          { error: 'This game has reached the 5-team limit on the free plan. The organiser needs to upgrade to Pro.' },
          { status: 403 }
        );
      }
    }
  }

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ name: name.trim(), game_id: game.id, score: 0, completed: [] })
    .select()
    .single();

  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });

  return NextResponse.json({ team, game, customMissions });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/team/login/route.ts
git commit -m "feat(remote-mode): extend login route for remote join (joinCode + memberName)"
```

---

## Task 5: Create `POST /api/team/heartbeat`

**Files:**
- Create: `app/api/team/heartbeat/route.ts`

- [ ] **Step 1: Create the heartbeat route**

Create `app/api/team/heartbeat/route.ts` with:

```typescript
// app/api/team/heartbeat/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  let body: { memberId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { memberId } = body;
  if (!memberId || typeof memberId !== 'string') {
    return NextResponse.json({ error: 'Missing memberId.' }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from('team_members')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/team/heartbeat/route.ts
git commit -m "feat(remote-mode): add POST /api/team/heartbeat route"
```

---

## Task 6: Extend `POST /api/poll` to include team members in remote mode

**Files:**
- Modify: `app/api/poll/route.ts`

The poll response currently returns `{ game, team, teams }`. When a team has `join_code` set (remote mode), extend it to include `members: [{id, name, online}]`. Online = `last_seen_at` within last 60 seconds.

- [ ] **Step 1: Add member fetching to the poll route**

Replace the full contents of `app/api/poll/route.ts` with:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const ONLINE_THRESHOLD_MS = 60_000; // 60 seconds

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Server-side team list cache ───────────────────────────────────────────────
const teamListCache = new Map<string, { data: unknown; expiresAt: number }>();

async function getCachedTeams(supabase: ReturnType<typeof getSupabase>, gameId: string) {
  const cached = teamListCache.get(gameId);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, score, active_effects, completed, finished_at')
    .eq('game_id', gameId)
    .order('score', { ascending: false });

  if (error) return null;

  teamListCache.set(gameId, { data: teams, expiresAt: Date.now() + 4000 });
  return teams;
}

// ── Combined poll endpoint ────────────────────────────────────────────────────
export async function POST(req: Request) {
  const { teamId, gameId, gameKey } = await req.json();

  if (!teamId || !gameId || !gameKey) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Run game + team queries in parallel, team list from cache
  const [gameRes, teamRes, teams] = await Promise.all([
    supabase.from('games').select('*').eq('game_key', gameKey.toUpperCase()).single(),
    supabase.from('teams').select('*').eq('id', teamId).single(),
    getCachedTeams(supabase, gameId),
  ]);

  if (gameRes.error || !gameRes.data) {
    return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
  }
  if (teamRes.error || !teamRes.data) {
    return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  }

  let game = gameRes.data;
  const team = teamRes.data;

  // Auto-finish if timer has expired
  if (game.status === 'active' && game.started_at) {
    const endTime = new Date(game.started_at).getTime() + game.duration_minutes * 60 * 1000;
    if (Date.now() >= endTime) {
      const { data: finished } = await supabase
        .from('games')
        .update({ status: 'finished' })
        .eq('id', game.id)
        .select()
        .single();
      if (finished) game = finished;
    }
  }

  // ── Remote mode: include team members with online status ──────────────────
  let members: Array<{ id: string; name: string; online: boolean }> | undefined;
  if (team.join_code) {
    const { data: rows } = await supabase
      .from('team_members')
      .select('id, name, last_seen_at')
      .eq('team_id', team.id)
      .order('created_at', { ascending: true });

    if (rows) {
      const cutoff = Date.now() - ONLINE_THRESHOLD_MS;
      members = rows.map((r: { id: string; name: string; last_seen_at: string }) => ({
        id: r.id,
        name: r.name,
        online: new Date(r.last_seen_at).getTime() > cutoff,
      }));
    }
  }

  return NextResponse.json({ game, team, teams: teams ?? [], ...(members ? { members } : {}) });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/poll/route.ts
git commit -m "feat(remote-mode): extend poll response to include members for remote teams"
```

---

## Task 7: Extend admin teams routes to include members

**Files:**
- Modify: `app/api/admin/teams/route.ts`

When any returned team has `join_code` set (remote mode), fetch its `team_members` and compute online status. Apply to both GET and POST handlers.

- [ ] **Step 1: Replace full contents of `app/api/admin/teams/route.ts`**

```typescript
// app/api/admin/teams/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

const ONLINE_THRESHOLD_MS = 60_000;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type RawTeam = { id: string; join_code?: string | null; [key: string]: unknown };
type MemberRow = { name: string; last_seen_at: string };

async function enrichWithMembers(supabase: ReturnType<typeof getSupabase>, teams: RawTeam[]) {
  const remoteTeamIds = teams.filter(t => t.join_code).map(t => t.id);
  if (remoteTeamIds.length === 0) return teams;

  const { data: allMembers } = await supabase
    .from('team_members')
    .select('team_id, name, last_seen_at')
    .in('team_id', remoteTeamIds)
    .order('created_at', { ascending: true });

  if (!allMembers) return teams;

  const cutoff = Date.now() - ONLINE_THRESHOLD_MS;
  const membersByTeam = new Map<string, Array<{ name: string; online: boolean }>>();
  for (const m of allMembers as Array<{ team_id: string } & MemberRow>) {
    const list = membersByTeam.get(m.team_id) ?? [];
    list.push({ name: m.name, online: new Date(m.last_seen_at).getTime() > cutoff });
    membersByTeam.set(m.team_id, list);
  }

  return teams.map(t => t.join_code ? { ...t, members: membersByTeam.get(t.id) ?? [] } : t);
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { gameId } = await req.json();
  let query = getSupabase().from('teams').select('*').order('score', { ascending: false });
  if (gameId) query = query.eq('game_id', gameId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const teams = await enrichWithMembers(getSupabase(), (data ?? []) as RawTeam[]);
  return NextResponse.json({ teams });
}

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');
  let query = getSupabase().from('teams').select('*').order('score', { ascending: false });
  if (gameId) query = query.eq('game_id', gameId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const teams = await enrichWithMembers(getSupabase(), (data ?? []) as RawTeam[]);
  return NextResponse.json({ teams }, { headers: { 'Cache-Control': 'no-store, no-cache' } });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/teams/route.ts
git commit -m "feat(remote-mode): include members with online status in admin teams response"
```

---

## Task 8: Extend `LoginScreen.tsx` for remote mode

**Files:**
- Modify: `components/screens/LoginScreen.tsx`

The login flow becomes two steps for team login:
1. User enters game key → "Next" button → we fetch the game to detect `remote_mode`
2a. Classic: show team name field, "Join" button
2b. Remote: show team name, team code (4 chars, monospace), your name, "Join" button

The `onTeamLogin` callback needs to accept the optional `memberId` and `memberName` from login response. This is threaded up through `page.tsx`.

- [ ] **Step 1: Update the `Props` type and component signature**

Change the `Props` type in `LoginScreen.tsx` from:
```typescript
type Props = {
  onTeamLogin: (team: Team, game: Game, customMissions?: import('@/lib/supabase').CustomMission[]) => void;
  onAdminLogin: () => void;
};
```

to:
```typescript
type Props = {
  onTeamLogin: (
    team: Team,
    game: Game,
    customMissions?: import('@/lib/supabase').CustomMission[],
    memberId?: string,
    memberName?: string
  ) => void;
  onAdminLogin: () => void;
};
```

- [ ] **Step 2: Add new state variables and implement two-step login**

After the existing `useState` declarations (after `const [showScanner, setShowScanner] = useState(false);`), add:

```typescript
  const [loginStep, setLoginStep] = useState<'key' | 'fields'>('key');
  const [detectedGame, setDetectedGame] = useState<Game | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [memberName, setMemberName] = useState('');
```

- [ ] **Step 3: Add `handleGameKeyNext` function**

Add this function after the `useEffect` and before `handleTeamLogin`:

```typescript
  async function handleGameKeyNext() {
    setError('');
    if (!gameKey.trim()) { setError(t('login.errGameKey')); return; }
    setLoading(true);
    try {
      // Light-weight check: try to find game by key (we'll use login endpoint for actual join)
      // Instead, we preview the game to detect remote_mode
      const res = await fetch('/api/team/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '__probe__', gameKey: gameKey.trim() }),
      });
      const data = await res.json();
      // We expect an error (empty team name after trim), but game info is in 400 for missing name
      // Actually we just need to know if remote_mode — fetch game via a different approach:
      // Use the same login call with a dummy name to get the game object back before team name check.
      // The route returns 400 for empty name, but we can also use a dedicated probe.
      // Simplest: proceed to 'fields' step regardless, detect remote_mode in handleTeamLogin.
      // The game is unknown until login. So we show both sets of fields and gate on response.
      setLoginStep('fields');
    } catch {
      setError(t('login.errNetwork'));
    } finally {
      setLoading(false);
    }
  }
```

Wait — the above approach is too complex. The simpler approach from the spec is:
> After entering the game key and receiving a game with `remote_mode: true`, show four fields.

The cleanest implementation without a separate probe endpoint: show all four fields upfront in step 2, but only validate/submit joinCode+memberName when the server responds with a remote game. Even simpler: always show step 2 with all four fields, and let the server decide. If the server is a classic game, it ignores joinCode/memberName.

However, the spec is clear that the UX should show remote-specific fields. Simplest correct approach: the form goes straight to the fields view without a probe, and shows the extra fields from the start. We'll detect remote mode after join (if the server returns memberId, we're in remote mode).

Replace `handleGameKeyNext` with just advancing to step 2:

```typescript
  function handleGameKeyNext() {
    setError('');
    if (!gameKey.trim()) { setError(t('login.errGameKey')); return; }
    setLoginStep('fields');
  }
```

And update `handleTeamLogin`:

```typescript
  async function handleTeamLogin() {
    setError('');
    if (!teamName.trim()) { setError(t('login.errTeamName')); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/team/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName.trim(),
          gameKey: gameKey.trim(),
          joinCode: joinCode.trim() || undefined,
          memberName: memberName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && data.error === 'Enter your name.') {
          // Server told us it's a remote game — show the extra fields hint
          setError('This game requires your name and team code. Fill in all fields below.');
          return;
        }
        setError(data.error);
        return;
      }
      onTeamLogin(data.team, data.game, data.customMissions ?? [], data.memberId, data.memberName);
    } catch {
      setError(t('login.errNetwork'));
    } finally {
      setLoading(false);
    }
  }
```

- [ ] **Step 4: Update the JSX for the team login form**

Replace the existing team mode JSX (inside `{mode === 'team' ? (` ... `)}`) with:

```tsx
          {mode === 'team' ? (
            <>
              {loginStep === 'key' ? (
                /* ── Step 1: Enter game key ── */
                <>
                  <div className="form-group">
                    <label className="form-label">{t('login.gameKeyLabel')}</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                      <input
                        type="text"
                        placeholder={t('login.gameKeyPlaceholder')}
                        maxLength={6}
                        value={gameKey}
                        onChange={e => setGameKey(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && handleGameKeyNext()}
                        style={{ letterSpacing: '4px', fontSize: '20px', textTransform: 'uppercase', flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        title="Scan QR code"
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '0 14px',
                          cursor: 'pointer',
                          fontSize: '22px',
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7" rx="1"/>
                          <rect x="14" y="3" width="7" height="7" rx="1"/>
                          <rect x="3" y="14" width="7" height="7" rx="1"/>
                          <rect x="14" y="14" width="3" height="3" rx="0.5"/>
                          <rect x="19" y="14" width="2" height="2" rx="0.5"/>
                          <rect x="14" y="19" width="2" height="2" rx="0.5"/>
                          <rect x="18" y="18" width="3" height="3" rx="0.5"/>
                        </svg>
                      </button>
                    </div>
                    {error && <p className="error-msg">{error}</p>}
                  </div>
                  {showScanner && (
                    <QrScanner
                      onScan={(key) => { setGameKey(key.slice(0, 6)); setShowScanner(false); }}
                      onClose={() => setShowScanner(false)}
                    />
                  )}
                  <button className="btn btn-primary btn-full" onClick={handleGameKeyNext} disabled={loading}>
                    {loading ? '...' : 'Next →'}
                  </button>
                </>
              ) : (
                /* ── Step 2: Team details (classic + remote) ── */
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <button
                      type="button"
                      onClick={() => { setLoginStep('key'); setError(''); setTeamName(''); setJoinCode(''); setMemberName(''); }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: "'Sora', sans-serif" }}
                    >
                      ← {gameKey}
                    </button>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('login.teamNameLabel')}</label>
                    <input
                      type="text"
                      placeholder={t('login.teamNamePlaceholder')}
                      maxLength={20}
                      value={teamName}
                      onChange={e => setTeamName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleTeamLogin()}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Team code <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(remote mode only)</span></label>
                    <input
                      type="text"
                      placeholder="X7K2"
                      maxLength={4}
                      value={joinCode}
                      onChange={e => setJoinCode(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleTeamLogin()}
                      style={{ letterSpacing: '6px', fontSize: '22px', fontFamily: 'monospace', textTransform: 'uppercase' }}
                    />
                    <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>Same code for everyone on your team — decide it together.</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Your name <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>(remote mode only)</span></label>
                    <input
                      type="text"
                      placeholder="First name"
                      maxLength={20}
                      value={memberName}
                      onChange={e => setMemberName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleTeamLogin()}
                    />
                  </div>
                  {error && (
                    error.includes('5-team limit') ? (
                      <div style={{ marginTop: '12px', padding: '14px 16px', background: 'rgba(124,189,212,0.08)', border: '1px solid rgba(124,189,212,0.25)', borderRadius: '10px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#7CBDD4', marginBottom: '4px' }}>{t('login.errFreePlanTitle')}</p>
                        <p style={{ fontSize: '12px', color: 'var(--muted, #8FA8C0)', lineHeight: 1.5 }}>{t('login.errFreePlanBody')}</p>
                      </div>
                    ) : (
                      <p className="error-msg">{error}</p>
                    )
                  )}
                  <button className="btn btn-primary btn-full" onClick={handleTeamLogin} disabled={loading}>
                    {loading ? t('login.joiningButton') : t('login.joinButton')}
                  </button>
                </>
              )}
            </>
          ) : (
```

Note: Close with `)}` matching the rest of the admin mode section.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/screens/LoginScreen.tsx
git commit -m "feat(remote-mode): two-step login form with joinCode and memberName fields"
```

---

## Task 9: Extend `app/play/page.tsx` — memberId state, heartbeat, members state

**Files:**
- Modify: `app/play/page.tsx`

Changes needed:
1. Add `memberId`, `memberName`, `members` state
2. Update `handleTeamLogin` to accept and store them
3. Save/restore `gameon_member` to/from localStorage
4. Add heartbeat `setInterval` (30s, fires when `game.remote_mode && memberId`)
5. Update poll handler to set `members` when returned
6. Pass `memberId` and `members` to `<MissionsScreen>`

- [ ] **Step 1: Add new state variables**

After `const [upgradeToast, setUpgradeToast] = useState<string | null>(null);`, add:

```typescript
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string; online: boolean }>>([]);
```

Also add refs for heartbeat (so interval always reads latest values):
```typescript
  const memberIdRef = useRef<string | null>(null);
  memberIdRef.current = memberId;
  const gameRef2 = gameRef; // gameRef already exists — use it directly
```

- [ ] **Step 2: Update `handleTeamLogin` to accept `memberId` and `memberName`**

Change the function signature from:
```typescript
  async function handleTeamLogin(t: Team, g: Game, cms: CustomMission[] = []) {
```
to:
```typescript
  async function handleTeamLogin(t: Team, g: Game, cms: CustomMission[] = [], mId?: string, mName?: string) {
```

At the end of the function body, before `setScreen('missions');`, add:
```typescript
    if (mId) { setMemberId(mId); setMemberName(mName ?? null); }
```

- [ ] **Step 3: Restore `gameon_member` on session hydration**

In the `restoreSession` function, after `setScreen('missions')`:
```typescript
        setTeam(JSON.parse(savedTeam));
        setGame(JSON.parse(savedGame));
        setScreen('missions');
        // Restore member session for remote mode
        const savedMember = localStorage.getItem('gameon_member');
        if (savedMember) {
          const { memberId: mId, memberName: mName } = JSON.parse(savedMember);
          if (mId) { setMemberId(mId); setMemberName(mName ?? null); }
        }
```

- [ ] **Step 4: Persist `gameon_member` in localStorage effect**

In the localStorage persistence `useEffect` (the one that watches `[screen, team, game, hydrated]`), add to the `else if` branch that writes localStorage:

```typescript
    } else if ((screen === 'missions' || screen === 'challenge' || screen === 'result') && team && game) {
      localStorage.setItem('gameon_screen', 'missions');
      localStorage.setItem('gameon_team', JSON.stringify(team));
      localStorage.setItem('gameon_game', JSON.stringify(game));
      if (memberId) {
        localStorage.setItem('gameon_member', JSON.stringify({ memberId, memberName }));
      }
```

And in the logout/login `else` branches, add:
```typescript
      localStorage.removeItem('gameon_member');
```

Also update the dependency array: `[screen, team, game, hydrated, memberId, memberName]`.

- [ ] **Step 5: Clear memberId on logout**

In `handleLogout`:
```typescript
  async function handleLogout() {
    await supabase.auth.signOut().catch(() => {});
    setTeam(null);
    setGame(null);
    setMemberId(null);
    setMemberName(null);
    setMembers([]);
    setScreen('login');
  }
```

- [ ] **Step 6: Add heartbeat interval**

Add a new `useEffect` after the master polling loop:

```typescript
  // ── Heartbeat: keep remote member presence alive ──
  useEffect(() => {
    if (!hydrated) return;
    // Only run when on the missions/challenge/result screens and we have a memberId
    if (screen !== 'missions' && screen !== 'challenge' && screen !== 'result') return;

    async function heartbeat() {
      const mId = memberIdRef.current;
      const g = gameRef.current;
      if (!mId || !g?.remote_mode) return;
      try {
        await fetch('/api/team/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: mId }),
          cache: 'no-store',
        });
      } catch { /* silent — heartbeat is best-effort */ }
    }

    heartbeat(); // immediate on mount
    const id = setInterval(heartbeat, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, screen === 'missions' || screen === 'challenge' || screen === 'result']);
```

- [ ] **Step 7: Update poll response handler to set members**

In the master polling loop, after `if (data.teams) setTeams(data.teams);`, add:
```typescript
        if (data.members) setMembers(data.members);
        else if (!data.game?.remote_mode) setMembers([]);
```

- [ ] **Step 8: Pass `memberId` and `members` to `<MissionsScreen>`**

Find where `<MissionsScreen>` is rendered and add two props:
```tsx
        <MissionsScreen
          team={team}
          game={game}
          teams={teams}
          onSelectMission={handleSelectMission}
          onLogout={handleLogout}
          onTeamUpdate={setTeam}
          onGameUpdate={setGame}
          customMissions={customMissions}
          memberId={memberId ?? undefined}
          members={members}
        />
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors. (If MissionsScreen Props don't yet include these fields, you'll fix that in Task 10.)

- [ ] **Step 10: Commit**

```bash
git add app/play/page.tsx
git commit -m "feat(remote-mode): memberId state, heartbeat interval, members from poll"
```

---

## Task 10: Add online member bar to `MissionsScreen.tsx`

**Files:**
- Modify: `components/screens/MissionsScreen.tsx`

Add two new optional props: `memberId` and `members`. When both are present and `game.remote_mode` is true, render a compact horizontal member bar below the game header showing each member's name and online status.

- [ ] **Step 1: Add new props to the `Props` type**

Find the `Props` type (around line 480):
```typescript
type Props = {
  team: Team;
  game: Game;
  teams: Team[];
  onSelectMission: (id: string) => void;
  onLogout: () => void;
  onTeamUpdate: (team: Team) => void;
  onGameUpdate: (game: Game) => void;
  customMissions?: Mission[];
};
```

Change to:
```typescript
type Props = {
  team: Team;
  game: Game;
  teams: Team[];
  onSelectMission: (id: string) => void;
  onLogout: () => void;
  onTeamUpdate: (team: Team) => void;
  onGameUpdate: (game: Game) => void;
  customMissions?: Mission[];
  memberId?: string;
  members?: Array<{ id: string; name: string; online: boolean }>;
};
```

- [ ] **Step 2: Accept new props in the component**

Find the main component function signature. It currently destructures `Props`. Add `memberId` and `members` to the destructuring:

```typescript
export default function MissionsScreen({
  team, game, teams,
  onSelectMission, onLogout, onTeamUpdate, onGameUpdate,
  customMissions = [],
  memberId,
  members = [],
}: Props) {
```

- [ ] **Step 3: Add the online member bar component**

Add this small component near the top of the file (before the `Props` type, after the existing helpers):

```typescript
// ── Online member bar (remote mode) ──────────────────────────────────────────
function MemberBar({ members, currentMemberId }: {
  members: Array<{ id: string; name: string; online: boolean }>;
  currentMemberId?: string;
}) {
  if (members.length === 0) return null;
  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px',
      padding: '8px 16px',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      {members.map(m => (
        <div key={m.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          borderRadius: '20px',
          background: m.id === currentMemberId ? 'rgba(124,189,212,0.12)' : 'var(--card)',
          border: `1px solid ${m.id === currentMemberId ? 'rgba(124,189,212,0.4)' : 'var(--border)'}`,
          fontSize: '12px',
          fontWeight: m.id === currentMemberId ? 700 : 500,
          color: 'var(--text)',
        }}>
          <span style={{ fontSize: '8px', color: m.online ? '#4CAF50' : 'var(--muted)' }}>●</span>
          {m.name}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Render the member bar in the main screen JSX**

Find where the main MissionsScreen returns its JSX. Locate the game header area (the nav or the first meaningful section after the nav). Add the `MemberBar` immediately after the `<nav>` closing tag:

```tsx
      {game.remote_mode && members.length > 0 && (
        <MemberBar members={members} currentMemberId={memberId} />
      )}
```

Search for the nav element in MissionsScreen — it's rendered near the start of the return statement. Place the MemberBar right after it.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add components/screens/MissionsScreen.tsx
git commit -m "feat(remote-mode): add online member bar to MissionsScreen"
```

---

## Task 11: Extend `AdminScreen.tsx` — remote mode toggle + expandable team cards

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

Two additions:
1. A "Remote / Distributed mode" toggle in the create game form (after the language selector)
2. In the leaderboard tab: expandable team cards showing members when `activeGame.remote_mode`

- [ ] **Step 1: Add `remoteMode` state variable**

Find the create form state block (around line 588, near `const [duration, setDuration] = useState(45);`). Add:

```typescript
  const [remoteMode, setRemoteMode] = useState(false);
```

- [ ] **Step 2: Add `remote_mode` to the `createGame` API call**

Find the `createGame` function (line ~778). The body JSON.stringify call currently ends with `language: gameLanguage`. Add `remote_mode: remoteMode` to it:

```typescript
      body: JSON.stringify({
        name: gameName,
        missions: selectedMissions,
        duration_minutes: duration,
        mission_max_pts: customPts,
        hide_leaderboard: hideLeaderboard,
        ai_photo_rating: aiPhotoRating,
        ai_photo_instructions: aiPhotoInstructions || null,
        language: gameLanguage,
        remote_mode: remoteMode,
      }),
```

- [ ] **Step 3: Add the toggle to the create form JSX**

In the `view === 'create'` section, find the language `<div className="form-group">` block (around line 2490). After that block's closing `</div>` (after the language block closes at line ~2521), add the remote mode toggle:

```tsx
          <div className="form-group" style={{ marginBottom: 0, marginTop: '10px' }}>
            <div
              onClick={() => setRemoteMode(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '12px 14px', background: 'var(--surface)', border: `1px solid ${remoteMode ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '10px' }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>🌍 Remote / Distributed mode</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
                  Each team member joins on their own device.
                </div>
              </div>
              <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: remoteMode ? 'var(--accent)' : 'var(--border)', position: 'relative', flexShrink: 0, marginLeft: '12px' }}>
                <div style={{ position: 'absolute', top: '2px', left: remoteMode ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </div>
            </div>
          </div>
```

Place this inside the first `<div className="card">` section (the settings card), after the language group div.

- [ ] **Step 4: Add `expandedTeamId` state for leaderboard cards**

Near the other dashboard state variables, add:

```typescript
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
```

- [ ] **Step 5: Update the leaderboard team rows to be expandable in remote mode**

Find the leaderboard rendering section (around line 2885-2903):

```tsx
              {sorted.length === 0 ? <div className="empty-state">No teams yet.</div> : sorted.map((t, i) => {
                const finishElapsed = ...
                return (
                  <div className="lb-row" key={t.id}>
                    <div className="lb-rank" ...>{RANK_ICONS[i] ?? i + 1}</div>
                    <div className="lb-name">{t.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', marginLeft: 'auto' }}>
                      <div className="lb-score">{t.score} p</div>
                      ...
                    </div>
                  </div>
                );
              })}
```

Replace the `return (...)` inside the map with:

```tsx
                const isExpanded = expandedTeamId === t.id;
                const hasMembers = activeGame.remote_mode && Array.isArray((t as Team & { members?: Array<{name: string; online: boolean}> }).members);
                const teamMembers = hasMembers ? (t as Team & { members?: Array<{name: string; online: boolean}> }).members! : [];
                return (
                  <div key={t.id} style={{ marginBottom: '4px' }}>
                    <div
                      className="lb-row"
                      style={{ cursor: hasMembers ? 'pointer' : 'default', borderRadius: isExpanded ? '10px 10px 0 0' : '10px' }}
                      onClick={() => hasMembers && setExpandedTeamId(isExpanded ? null : t.id)}
                    >
                      <div className="lb-rank" style={{ color: RANK_COLORS[i] ?? 'var(--muted)' }}>{RANK_ICONS[i] ?? i + 1}</div>
                      <div className="lb-name">{t.name}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', marginLeft: 'auto' }}>
                        <div className="lb-score">{t.score} p</div>
                        {finishElapsed ? (
                          <div style={{ fontSize: '11px', color: 'var(--accent3)', letterSpacing: '0.5px' }}>🏁 {finishElapsed}</div>
                        ) : (
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{t.completed?.length ?? 0}/{activeGame.missions.length} done</div>
                        )}
                      </div>
                      {hasMembers && (
                        <div style={{ marginLeft: '10px', color: 'var(--muted)', fontSize: '12px', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</div>
                      )}
                    </div>
                    {isExpanded && teamMembers.length > 0 && (
                      <div style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderTop: 'none',
                        borderRadius: '0 0 10px 10px',
                        padding: '10px 14px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}>
                        {teamMembers.map(m => (
                          <div key={m.name} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '12px',
                            color: m.online ? 'var(--text)' : 'var(--muted)',
                          }}>
                            <span style={{ fontSize: '8px', color: m.online ? '#4CAF50' : 'var(--muted)' }}>●</span>
                            {m.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat(remote-mode): remote mode toggle in create form + expandable team cards in leaderboard"
```

---

## Task 12: End-to-end verification

**Files:**
- No code changes — manual verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/signevallin/Desktop/GameOn && npm run dev
```

Open `http://localhost:3000/play` in a browser.

- [ ] **Step 2: Verify classic mode is unchanged**

1. Log in as admin, create a game with Remote mode **off**
2. Log in as a team (game key + team name) — should work exactly as before
3. The login form step 1 shows game key, step 2 shows team name + greyed-out remote fields
4. Joining succeeds, no member bar appears in MissionsScreen

- [ ] **Step 3: Verify remote mode game creation**

1. Log in as admin, create a game with Remote mode **on**
2. Verify the game appears in the admin dashboard

- [ ] **Step 4: Verify remote mode login**

1. Two browser windows side-by-side
2. In window 1: game key → team name "Team Alpha" → team code "AAAA" → name "Anna" → Join
3. In window 2: same game key → same team name "Team Alpha" → same code "AAAA" → name "Erik" → Join
4. Both should join successfully and see each other in the member bar within 5 seconds
5. Anna: 🟢 Anna  🟢 Erik
6. Erik: 🟢 Anna  🟢 Erik (Anna highlighted for Anna, Erik highlighted for Erik)

- [ ] **Step 5: Verify online/offline indicator**

1. Close window 2 (Erik's tab)
2. Wait 65 seconds
3. In window 1: Anna should see Erik as ⚫ (offline) after next poll

- [ ] **Step 6: Verify admin expandable team cards**

1. In the admin dashboard, open the active remote mode game
2. Go to Scores tab
3. Click on Team Alpha's card — should expand to show Anna 🟢 Erik ⚫

- [ ] **Step 7: Commit a final summary commit**

```bash
git add -p  # stage any un-committed tweaks
git commit -m "feat(remote-mode): complete remote/distributed team mode implementation"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `games.remote_mode` column — Task 2
- ✅ `teams.join_code` column — Task 2
- ✅ `team_members` table with RLS — Task 2
- ✅ `POST /api/admin/game` accepts `remote_mode` — Task 3
- ✅ `POST /api/team/login` handles remote join: joinCode + memberName, team cap, creates team_members row — Task 4
- ✅ Error: wrong name/code → 404; team full → 409; missing memberName → 400 — Task 4
- ✅ `POST /api/team/heartbeat` updates `last_seen_at` — Task 5
- ✅ Poll returns members with online status when team has join_code — Task 6
- ✅ Admin teams response includes members with online status — Task 7
- ✅ LoginScreen two-step form, remote mode fields — Task 8
- ✅ `memberId`/`memberName` state, heartbeat, localStorage persist/restore — Task 9
- ✅ Online member bar in MissionsScreen — Task 10
- ✅ Remote mode toggle in admin create form — Task 11
- ✅ Expandable team cards with member presence in admin leaderboard — Task 11
- ✅ Classic mode fully unchanged (gated on `game.remote_mode`) — Tasks 3–11

**Out of scope (per spec):** relay missions, voice/video, photo collage — not included.
