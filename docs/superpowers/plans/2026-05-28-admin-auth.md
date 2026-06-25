# Admin Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared admin password with per-customer Supabase Auth accounts, scope games to their owner, and migrate powerup state from the global `settings` table into each `games` row.

**Architecture:** Supabase Auth handles registration/login client-side. Every admin API route validates the user's JWT (sent as `Authorization: Bearer <token>`) using a shared server helper. Games are scoped to `user_id`; a super-admin flag in `app_metadata` bypasses the filter.

**Tech Stack:** Next.js App Router, Supabase Auth (`supabase.auth.*`), Supabase service-role client for server-side token validation, TypeScript.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `docs/sql/2026-05-28-auth-migration.sql` | Create | One-time DB migration |
| `lib/supabase.ts` | Modify | Add `user_id`, `powerups_used`, `hot_potato` to `Game` type |
| `lib/auth-server.ts` | Create | Server-side JWT validation helper used by all admin routes |
| `app/api/settings/route.ts` | Modify | Read `powerups_used` + `hot_potato` from `games` row |
| `app/api/admin/powerup/route.ts` | Modify | Write `powerups_used` to `games`; validate auth |
| `app/api/admin/powerup/resolve-hot-potato/route.ts` | Modify | Read/write `hot_potato` on `games`; validate auth |
| `app/api/admin/game/start/route.ts` | Modify | Clear `powerups_used` + `hot_potato` on `games` on restart; validate auth |
| `app/api/admin/game/route.ts` | Modify | Set `user_id` on create; filter list by `user_id`; validate auth |
| `app/api/admin/teams/route.ts` | Modify | Validate auth before returning teams |
| `app/api/admin/photos/rate/route.ts` | Modify | Validate auth |
| `app/api/admin/superadmin/users/route.ts` | Create | Super-admin only: list all customers + game counts |
| `app/page.tsx` | Modify | Detect Supabase session on mount; remove localStorage admin tracking |
| `components/screens/LoginScreen.tsx` | Modify | Email/password form + Register toggle |
| `components/screens/AdminScreen.tsx` | Modify | Send JWT in every API call; signOut; super-admin customers tab |
| `app/api/admin/login/route.ts` | Delete | Replaced by Supabase Auth |

---

## Task 1: SQL Migration

**Files:**
- Create: `docs/sql/2026-05-28-auth-migration.sql`

- [ ] **Step 1: Create the SQL file**

```sql
-- docs/sql/2026-05-28-auth-migration.sql
-- Run this once in the Supabase SQL editor.

-- 1. Add user_id to games
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Move powerups_used and hot_potato from settings → games
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS powerups_used TEXT[] DEFAULT '{}';

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS hot_potato JSONB DEFAULT NULL;

-- 3. Back-fill: assign all existing games to the super-admin.
--    Run AFTER creating your super-admin account.
--    Replace '00000000-0000-0000-0000-000000000000' with your real user UUID.
-- UPDATE games SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;

-- 4. Enable RLS on games (defence-in-depth; API routes enforce auth separately)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "games_owner_select" ON games FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "games_owner_insert" ON games FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "games_owner_update" ON games FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "games_owner_delete" ON games FOR DELETE
  USING (user_id = auth.uid());
```

- [ ] **Step 2: Run the migration in Supabase**

Open https://supabase.com/dashboard → your project → SQL Editor → paste and run the file contents (skip the UPDATE back-fill line for now).

- [ ] **Step 3: Create your super-admin account first**

Open the app in a browser, click Admin → Register, enter your email + password.
Then go to Supabase Dashboard → Authentication → Users → find your account → Edit → `app_metadata` → add `{"role": "superadmin"}` → Save.

- [ ] **Step 4: Run the back-fill UPDATE**

In SQL Editor, run:
```sql
UPDATE games
SET user_id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com')
WHERE user_id IS NULL;
```

- [ ] **Step 5: Commit the SQL file**

```bash
git add docs/sql/2026-05-28-auth-migration.sql
git commit -m "chore: add auth migration SQL"
```

---

## Task 2: Server auth helper

**Files:**
- Create: `lib/auth-server.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/auth-server.ts
import { createClient } from '@supabase/supabase-js';

export type AdminUser = {
  userId: string;
  isSuperAdmin: boolean;
};

/**
 * Validates the Bearer token sent by the admin client.
 * Throws an Error if missing or invalid.
 */
export async function validateAdminToken(req: Request): Promise<AdminUser> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized');

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Unauthorized');

  return {
    userId: user.id,
    isSuperAdmin: user.app_metadata?.role === 'superadmin',
  };
}

/** Returns a 401 JSON response — use when validateAdminToken throws. */
export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized.' }, { status: 401 });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/auth-server.ts
git commit -m "feat: add server-side admin token validation helper"
```

---

## Task 3: Update Game type

**Files:**
- Modify: `lib/supabase.ts`

- [ ] **Step 1: Add new fields to the Game type**

Replace the existing `Game` type:

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
  user_id?: string;
  powerups_used?: string[];
  hot_potato?: {
    mission_id: string;
    expires_at: string;
    penalty_pts: number;
    game_id: string;
  } | null;
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: add user_id, powerups_used, hot_potato to Game type"
```

---

## Task 4: Migrate /api/settings to read from games

**Files:**
- Modify: `app/api/settings/route.ts`

`/api/settings` is called by `AdminScreen` to get `powerups_used` and `hot_potato` for the active game. It now needs a `gameId` in the request body and reads from `games` instead of `settings`.

- [ ] **Step 1: Replace route contents**

```typescript
// app/api/settings/route.ts
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

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { gameId } = await req.json();
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const { data, error } = await getSupabase()
    .from('games')
    .select('powerups_used, hot_potato')
    .eq('id', gameId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });

  return NextResponse.json({
    powerups_used: data.powerups_used ?? [],
    hot_potato: data.hot_potato ?? null,
  });
}

// GET kept for compatibility — requires gameId as query param
export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const { data, error } = await getSupabase()
    .from('games')
    .select('powerups_used, hot_potato')
    .eq('id', gameId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });

  return NextResponse.json({
    powerups_used: data.powerups_used ?? [],
    hot_potato: data.hot_potato ?? null,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/settings/route.ts
git commit -m "feat: migrate /api/settings to read powerups from games table"
```

---

## Task 5: Migrate /api/admin/powerup to write to games

**Files:**
- Modify: `app/api/admin/powerup/route.ts`

Replace all reads/writes to `settings.powerups_used` with `games.powerups_used`. Add auth validation.

- [ ] **Step 1: Replace route contents**

```typescript
// app/api/admin/powerup/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';
import { MISSION_SUPER_CATEGORY, SUPER_CATEGORIES } from '@/lib/superCategories';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MESSAGES: Record<string, string> = {
  sabotage: '💻 YOU HAVE BEEN HACKED! -100 points deducted from your team',
  double_points: '🎯 POWER-UP! Double points on your next mission!',
  final_frenzy: '🔥 FINAL FRENZY ACTIVATED! All points are now doubled!',
};

const VALID_TYPES = ['sabotage', 'double_points', 'fake_hint', 'final_frenzy', 'hot_potato'];

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { type, targetTeamId, message, gameId, missionId, missionName } = await req.json();

  if (!type) return NextResponse.json({ error: 'Missing type.' }, { status: 400 });
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type.' }, { status: 400 });
  if (type === 'fake_hint' && !message?.trim()) return NextResponse.json({ error: 'Message required for fake_hint.' }, { status: 400 });
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const supabase = getSupabase();

  // ── HOT POTATO ───────────────────────────────────────────────────────────────
  if (type === 'hot_potato') {
    if (!missionId || !missionName) return NextResponse.json({ error: 'missionId and missionName required.' }, { status: 400 });

    const { data: game } = await supabase
      .from('games').select('hot_potato').eq('id', gameId).single();

    if (game?.hot_potato) {
      return NextResponse.json({ error: 'A Hot Potato is already active.' }, { status: 409 });
    }

    const mission = MISSIONS.find(m => m.id === missionId);
    const superKey = missionId ? MISSION_SUPER_CATEGORY[missionId] : undefined;
    const superLabel = superKey ? SUPER_CATEGORIES[superKey].label : undefined;
    const missionLabel = mission
      ? `${mission.icon} ${mission.name}${superLabel ? ` (${superLabel})` : ''}`
      : missionName;

    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    const hotPotatoData = { mission_id: missionId, expires_at: expiresAt, penalty_pts: 500, game_id: gameId };

    await supabase.from('games').update({
      hot_potato: hotPotatoData,
      updated_at: new Date().toISOString(),
    }).eq('id', gameId);

    // Notify all teams
    const { data: allTeams } = await supabase.from('teams').select('id').eq('game_id', gameId);
    if (allTeams) {
      for (const t of allTeams) {
        await supabase.from('teams').update({
          pending_notification: {
            type: 'hot_potato',
            message: `💣 TIME BOMB! Complete '${missionLabel}' within 3 minutes or lose 500 points!`,
          },
          updated_at: new Date().toISOString(),
        }).eq('id', t.id);
      }
    }

    return NextResponse.json({ ok: true, expiresAt });
  }

  // final_frenzy and "all" broadcasts
  const isBroadcast = type === 'final_frenzy' || targetTeamId === 'all';
  if (!isBroadcast && !targetTeamId) return NextResponse.json({ error: 'Missing targetTeamId.' }, { status: 400 });

  // Read powerups_used from games
  const { data: game, error: gameErr } = await supabase
    .from('games').select('powerups_used').eq('id', gameId).single();

  if (gameErr || !game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });

  const used: string[] = game.powerups_used ?? [];
  const usedKey = isBroadcast ? `${type}_all` : `${type}_${targetTeamId}`;

  if (used.includes(usedKey)) {
    return NextResponse.json({ error: 'Power-up already used.' }, { status: 409 });
  }

  // ── BROADCAST ────────────────────────────────────────────────────────────────
  if (isBroadcast) {
    const { data: allTeams, error: teamsErr } = await supabase
      .from('teams').select('id, score, active_effects').eq('game_id', gameId);

    if (teamsErr || !allTeams) return NextResponse.json({ error: 'Could not load teams.' }, { status: 500 });

    const notification = { type, message: MESSAGES[type] ?? message };

    const updates = allTeams.map(t => {
      const update: Record<string, unknown> = {
        id: t.id,
        pending_notification: notification,
        updated_at: new Date().toISOString(),
      };
      if (type === 'final_frenzy' || type === 'double_points') {
        update.double_points = true;
      }
      if (type === 'final_frenzy') {
        const effects = (t.active_effects as Record<string, unknown>) ?? {};
        update.active_effects = { ...effects, final_frenzy: true };
      }
      if (type === 'sabotage') {
        const effects = (t.active_effects as Record<string, string>) ?? {};
        const shieldUntil = effects.shield_until ? new Date(effects.shield_until) : null;
        if (!shieldUntil || shieldUntil <= new Date()) {
          update.score = Math.max(0, (t.score ?? 0) - 100);
        }
      }
      return update;
    });

    for (const upd of updates) {
      await supabase.from('teams').update(upd).eq('id', upd.id);
    }

    await supabase.from('games').update({
      powerups_used: [...used, usedKey],
      updated_at: new Date().toISOString(),
    }).eq('id', gameId);

    return NextResponse.json({ ok: true, usedKey, broadcast: true });
  }

  // ── SINGLE TEAM ──────────────────────────────────────────────────────────────
  const { data: team, error: teamErr } = await supabase
    .from('teams').select('score, active_effects').eq('id', targetTeamId).single();

  if (teamErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  if (type === 'sabotage') {
    const effects = (team.active_effects as Record<string, string>) ?? {};
    const shieldUntil = effects.shield_until ? new Date(effects.shield_until) : null;
    if (shieldUntil && shieldUntil > new Date()) {
      return NextResponse.json({ error: 'That team has a shield active! Sabotage blocked.' }, { status: 400 });
    }
  }

  const notification = {
    type,
    message: type === 'fake_hint' ? message.trim() : MESSAGES[type],
  };

  const teamUpdate: Record<string, unknown> = {
    pending_notification: notification,
    updated_at: new Date().toISOString(),
  };

  if (type === 'sabotage') teamUpdate.score = Math.max(0, (team.score ?? 0) - 100);
  if (type === 'double_points') teamUpdate.double_points = true;

  await supabase.from('teams').update(teamUpdate).eq('id', targetTeamId);

  await supabase.from('games').update({
    powerups_used: [...used, usedKey],
    updated_at: new Date().toISOString(),
  }).eq('id', gameId);

  return NextResponse.json({ ok: true, usedKey });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/powerup/route.ts
git commit -m "feat: migrate admin powerup to write to games table, add auth"
```

---

## Task 6: Migrate resolve-hot-potato to games

**Files:**
- Modify: `app/api/admin/powerup/resolve-hot-potato/route.ts`

- [ ] **Step 1: Replace route contents**

```typescript
// app/api/admin/powerup/resolve-hot-potato/route.ts
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

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { gameId } = await req.json();
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const supabase = getSupabase();

  const { data: game, error: gameErr } = await supabase
    .from('games').select('hot_potato').eq('id', gameId).single();

  if (gameErr || !game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });

  const hp = game.hot_potato as {
    mission_id: string;
    expires_at: string;
    penalty_pts: number;
    game_id: string;
  } | null;

  if (!hp) return NextResponse.json({ ok: true, status: 'no_active' });

  const now = new Date();
  if (now < new Date(hp.expires_at)) {
    return NextResponse.json({ ok: true, status: 'not_expired', expires_at: hp.expires_at });
  }

  // Expired — penalize teams that haven't completed the mission
  const { data: teams, error: teamsErr } = await supabase
    .from('teams').select('id, score, completed').eq('game_id', hp.game_id);

  if (teamsErr || !teams) return NextResponse.json({ error: 'Could not load teams.' }, { status: 500 });

  const penalizedTeams: string[] = [];
  for (const team of teams) {
    const completed: string[] = team.completed ?? [];
    if (!completed.includes(hp.mission_id)) {
      await supabase.from('teams').update({
        score: Math.max(0, (team.score ?? 0) - hp.penalty_pts),
        pending_notification: {
          type: 'hot_potato_penalty',
          message: `💥 BOOM! You didn't complete the Time Bomb mission in time. -${hp.penalty_pts} points!`,
        },
        updated_at: now.toISOString(),
      }).eq('id', team.id);
      penalizedTeams.push(team.id);
    }
  }

  // Clear hot_potato on the game
  await supabase.from('games').update({
    hot_potato: null,
    updated_at: now.toISOString(),
  }).eq('id', gameId);

  return NextResponse.json({ ok: true, status: 'resolved', penalized: penalizedTeams.length });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/powerup/resolve-hot-potato/route.ts
git commit -m "feat: migrate resolve-hot-potato to read/write games table"
```

---

## Task 7: Update game/start to use games + auth

**Files:**
- Modify: `app/api/admin/game/start/route.ts`

- [ ] **Step 1: Replace route contents**

```typescript
// app/api/admin/game/start/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { gameId, action } = await req.json();
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const updates =
    action === 'finish'
      ? { status: 'finished' }
      : action === 'restart'
      ? { status: 'draft', started_at: null }
      : { status: 'active', started_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('games')
    .update(updates)
    .eq('id', gameId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // On restart: clear powerup state on the game row and reset team effects
  if (action === 'restart') {
    await supabase.from('games').update({
      powerups_used: [],
      hot_potato: null,
      updated_at: new Date().toISOString(),
    }).eq('id', gameId);

    await supabase.from('teams').update({
      active_effects: {},
      double_points: false,
      updated_at: new Date().toISOString(),
    }).eq('game_id', gameId);
  }

  return NextResponse.json({ game: data });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/game/start/route.ts
git commit -m "feat: clear powerups on games table during restart, add auth"
```

---

## Task 8: Scope games to user_id + auth

**Files:**
- Modify: `app/api/admin/game/route.ts`

- [ ] **Step 1: Replace POST handler** — add `user_id` on create, filter list by `user_id`, add auth

Find and replace the entire file content:

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

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  let query = adminClient().from('games').select('*').order('created_at', { ascending: false });
  if (!admin.isSuperAdmin) query = query.eq('user_id', admin.userId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ games: data }, { headers: { 'Cache-Control': 'no-store, no-cache' } });
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const body = await req.json();

  if (body.action === 'list') {
    let query = adminClient().from('games').select('*').order('created_at', { ascending: false });
    if (!admin.isSuperAdmin) query = query.eq('user_id', admin.userId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ games: data });
  }

  if (body.action === 'delete') {
    const { gameId } = body;
    if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

    // Verify ownership
    const { data: game } = await adminClient().from('games').select('user_id').eq('id', gameId).single();
    if (!game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    if (!admin.isSuperAdmin && game.user_id !== admin.userId) return unauthorizedResponse();

    const { data: gameTeams } = await adminClient().from('teams').select('id').eq('game_id', gameId);
    const teamIds = (gameTeams ?? []).map((t: { id: string }) => t.id);
    if (teamIds.length) {
      await adminClient().from('photo_submissions').delete().in('team_id', teamIds);
    }
    await adminClient().from('teams').delete().eq('game_id', gameId);
    const { error } = await adminClient().from('games').delete().eq('id', gameId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Create game
  const { name, missions, duration_minutes, mission_max_pts, hide_leaderboard } = body;
  if (!missions?.length) return NextResponse.json({ error: 'Select at least one mission.' }, { status: 400 });

  let key = '';
  let attempts = 0;
  while (attempts < 10) {
    key = generateKey();
    const { data: existing } = await adminClient().from('games').select('id').eq('game_key', key).single();
    if (!existing) break;
    attempts++;
  }

  const { data: game, error } = await adminClient()
    .from('games')
    .insert({
      game_key: key,
      name: name?.trim() || null,
      missions,
      duration_minutes: duration_minutes ?? 45,
      mission_max_pts: mission_max_pts ?? {},
      hide_leaderboard: hide_leaderboard ?? false,
      status: 'draft',
      user_id: admin.userId,
      powerups_used: [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ game });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/game/route.ts
git commit -m "feat: scope games to user_id, add auth to game route"
```

---

## Task 9: Add auth to teams + photos routes

**Files:**
- Modify: `app/api/admin/teams/route.ts`
- Modify: `app/api/admin/photos/rate/route.ts`

- [ ] **Step 1: Add auth to teams route**

Replace file content:

```typescript
// app/api/admin/teams/route.ts
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

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { gameId } = await req.json();
  let query = getSupabase().from('teams').select('*').order('score', { ascending: false });
  if (gameId) query = query.eq('game_id', gameId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ teams: data });
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
  return NextResponse.json({ teams: data }, { headers: { 'Cache-Control': 'no-store, no-cache' } });
}
```

- [ ] **Step 2: Add auth to photos/rate route** — open `app/api/admin/photos/rate/route.ts`, add at the top of the `POST` handler:

```typescript
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
// ...
export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();
  // ... rest of handler unchanged
```

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/teams/route.ts app/api/admin/photos/rate/route.ts
git commit -m "feat: add auth validation to teams and photos routes"
```

---

## Task 10: Super-admin users route

**Files:**
- Create: `app/api/admin/superadmin/users/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/admin/superadmin/users/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin?.isSuperAdmin) return unauthorizedResponse();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: games } = await supabase.from('games').select('user_id');
  const gameCounts = (games ?? []).reduce((acc: Record<string, number>, g) => {
    if (g.user_id) acc[g.user_id] = (acc[g.user_id] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    users: users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      game_count: gameCounts[u.id] ?? 0,
      is_super_admin: u.app_metadata?.role === 'superadmin',
    })),
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/admin/superadmin/users/route.ts
git commit -m "feat: add superadmin users listing route"
```

---

## Task 11: Update page.tsx session management

**Files:**
- Modify: `app/page.tsx`

Replace the `useEffect` that restores from localStorage and the admin-related localStorage writes with Supabase Auth session detection. Team session stays in localStorage as before.

- [ ] **Step 1: Add supabase import at top of file**

Add after the existing imports:
```typescript
import { supabase } from '@/lib/supabase';
```

- [ ] **Step 2: Replace the hydration useEffect**

Find and replace:
```typescript
  // ── Restore session from localStorage on first mount ──
  useEffect(() => {
    try {
      const savedScreen = localStorage.getItem('gameon_screen') as Screen | null;
      const savedTeam = localStorage.getItem('gameon_team');
      const savedGame = localStorage.getItem('gameon_game');

      if (savedScreen === 'admin') {
        setScreen('admin');
      } else if (savedScreen === 'missions' && savedTeam && savedGame) {
        setTeam(JSON.parse(savedTeam));
        setGame(JSON.parse(savedGame));
        setScreen('missions');
      }
    } catch { /* corrupted storage – start fresh */ }
    setHydrated(true);
  }, []);
```

With:
```typescript
  // ── Restore session on first mount ──
  useEffect(() => {
    async function restoreSession() {
      try {
        // 1. Check for Supabase admin session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setScreen('admin');
          setHydrated(true);
          return;
        }
        // 2. Fall back to localStorage for team session
        const savedScreen = localStorage.getItem('gameon_screen') as Screen | null;
        const savedTeam = localStorage.getItem('gameon_team');
        const savedGame = localStorage.getItem('gameon_game');
        if (savedScreen === 'missions' && savedTeam && savedGame) {
          setTeam(JSON.parse(savedTeam));
          setGame(JSON.parse(savedGame));
          setScreen('missions');
        }
      } catch { /* corrupted storage – start fresh */ }
      setHydrated(true);
    }
    restoreSession();
  }, []);
```

- [ ] **Step 3: Update the session persistence useEffect**

Find and replace:
```typescript
    if (screen === 'admin') {
      localStorage.setItem('gameon_screen', 'admin');
      localStorage.removeItem('gameon_team');
      localStorage.removeItem('gameon_game');
    } else if
```

With:
```typescript
    if (screen === 'admin') {
      // Admin session managed by Supabase Auth — no localStorage needed
      localStorage.removeItem('gameon_screen');
      localStorage.removeItem('gameon_team');
      localStorage.removeItem('gameon_game');
    } else if
```

- [ ] **Step 4: Update handleLogout to sign out from Supabase**

Find and replace:
```typescript
  function handleLogout() {
    setTeam(null);
    setGame(null);
    setScreen('login');
  }
```

With:
```typescript
  async function handleLogout() {
    await supabase.auth.signOut().catch(() => {});
    setTeam(null);
    setGame(null);
    setScreen('login');
  }
```

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: restore admin session from Supabase Auth on mount"
```

---

## Task 12: Update LoginScreen

**Files:**
- Modify: `components/screens/LoginScreen.tsx`

Replace the admin password input with email + password fields and a register/login toggle.

- [ ] **Step 1: Replace LoginScreen contents**

```typescript
'use client';
import { useState, useEffect } from 'react';
import { Team, Game, supabase } from '@/lib/supabase';
import GameOnLogo from '@/components/GameOnLogo';
import dynamic from 'next/dynamic';

const QrScanner = dynamic(() => import('@/components/QrScanner'), { ssr: false });

type Props = {
  onTeamLogin: (team: Team, game: Game) => void;
  onAdminLogin: () => void;
};

export default function LoginScreen({ onTeamLogin, onAdminLogin }: Props) {
  const [mode, setMode] = useState<'team' | 'admin'>('team');
  const [adminMode, setAdminMode] = useState<'login' | 'register'>('login');
  const [teamName, setTeamName] = useState('');
  const [gameKey, setGameKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get('key');
    if (key) setGameKey(key.toUpperCase());
  }, []);

  async function handleTeamLogin() {
    setError('');
    if (!teamName.trim()) { setError('Enter a team name.'); return; }
    if (!gameKey.trim()) { setError('Enter the game key.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/team/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName.trim(), gameKey: gameKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onTeamLogin(data.team, data.game);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin() {
    setError('');
    if (!email.trim()) { setError('Enter your email.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) { setError(authError.message); return; }
      onAdminLogin();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminRegister() {
    setError('');
    if (!email.trim()) { setError('Enter your email.'); return; }
    if (!password) { setError('Enter a password.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (authError) { setError(authError.message); return; }
      // Auto-sign in after register
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) { setError('Account created! Please log in.'); setAdminMode('login'); return; }
      onAdminLogin();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '480px', padding: '20px', position: 'relative', zIndex: 1 }} className="fade-in">
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <GameOnLogo size={58} />
          <p style={{ color: 'var(--muted)', marginTop: '12px', fontSize: '14px' }}>Select your role to log in</p>
        </div>

        <div className="login-tabs">
          <button className={`tab-btn${mode === 'team' ? ' active' : ''}`} onClick={() => { setMode('team'); setError(''); }}>
            🧑‍💻 TEAM
          </button>
          <button className={`tab-btn${mode === 'admin' ? ' active' : ''}`} onClick={() => { setMode('admin'); setError(''); }}>
            🛡️ ADMIN
          </button>
        </div>

        <div className="card">
          {mode === 'team' ? (
            <>
              <div className="form-group">
                <label className="form-label">Team Name</label>
                <input
                  type="text"
                  placeholder="E.g. Team Frontend"
                  maxLength={20}
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTeamLogin()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Game Key (from the organiser)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                  <input
                    type="text"
                    placeholder="E.g. X7K2P9"
                    maxLength={6}
                    value={gameKey}
                    onChange={e => setGameKey(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleTeamLogin()}
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
                {error && mode === 'team' && <p className="error-msg">{error}</p>}
              </div>
              {showScanner && (
                <QrScanner
                  onScan={(key) => { setGameKey(key.slice(0, 6)); setShowScanner(false); }}
                  onClose={() => setShowScanner(false)}
                />
              )}
              <button className="btn btn-primary btn-full" onClick={handleTeamLogin} disabled={loading}>
                {loading ? 'JOINING...' : 'JOIN GAME →'}
              </button>
            </>
          ) : (
            <>
              {/* Login / Register toggle */}
              <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: '8px', padding: '3px', gap: '3px', marginBottom: '20px' }}>
                {(['login', 'register'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { setAdminMode(m); setError(''); }}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                      fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '12px',
                      letterSpacing: '0.5px',
                      background: adminMode === m ? 'var(--accent)' : 'transparent',
                      color: adminMode === m ? 'var(--bg)' : 'var(--muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {m === 'login' ? 'LOG IN' : 'REGISTER'}
                  </button>
                ))}
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (adminMode === 'login' ? handleAdminLogin() : handleAdminRegister())}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (adminMode === 'login' ? handleAdminLogin() : handleAdminRegister())}
                />
              </div>
              {adminMode === 'register' && (
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdminRegister()}
                  />
                </div>
              )}
              {error && mode === 'admin' && <p className="error-msg" style={{ marginBottom: '12px' }}>{error}</p>}
              <button
                className="btn btn-primary btn-full"
                onClick={adminMode === 'login' ? handleAdminLogin : handleAdminRegister}
                disabled={loading}
              >
                {loading ? '...' : adminMode === 'login' ? 'LOG IN →' : 'CREATE ACCOUNT →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Export `supabase` from lib/supabase.ts** (it's already exported — verify the import works)

Check that `lib/supabase.ts` exports `supabase`:
```bash
grep "^export const supabase" /Users/signevallin/Desktop/GameOn/lib/supabase.ts
```
Expected: `export const supabase = createClient(supabaseUrl, supabaseAnonKey);`

- [ ] **Step 3: Commit**

```bash
git add components/screens/LoginScreen.tsx
git commit -m "feat: replace admin password login with Supabase Auth email/password + register"
```

---

## Task 13: Update AdminScreen — auth token + signOut + super-admin tab

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

- [ ] **Step 1: Add supabase import and authToken state**

At the top of the file, add after existing imports:
```typescript
import { supabase } from '@/lib/supabase';
```

Inside the `AdminScreen` component, add after the existing `useState` declarations:
```typescript
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; email: string; created_at: string; last_sign_in_at: string | null; game_count: number; is_super_admin: boolean }[]>([]);

  // Load auth token on mount and subscribe to changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthToken(session?.access_token ?? null);
      setIsSuperAdmin(session?.user?.app_metadata?.role === 'superadmin');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token ?? null);
      setIsSuperAdmin(session?.user?.app_metadata?.role === 'superadmin');
    });
    return () => subscription.unsubscribe();
  }, []);
```

- [ ] **Step 2: Update the POST helper to include Authorization header**

Find:
```typescript
  const POST = (url: string, body?: object) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  });
```

Replace with:
```typescript
  const POST = useCallback((url: string, body?: object) => fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  }), [authToken]);
```

- [ ] **Step 3: Pass gameId to /api/settings calls**

There are two places where `POST('/api/settings')` is called. Both need `{ gameId: activeGame.id }` (or `gameId` from the closure). Find and update:

First call (in `loadGameData`):
```typescript
    POST('/api/settings'),
```
→
```typescript
    POST('/api/settings', { gameId: game.id }),
```

Second call (in the polling `poll` function inside the `useEffect`):
```typescript
        POST('/api/settings'),
```
→
```typescript
        POST('/api/settings', { gameId }),
```

Third call (in `activatePowerup`):
```typescript
      const sd = await POST('/api/settings').then(r => r.json());
```
→
```typescript
      const sd = await POST('/api/settings', { gameId: activeGame?.id }).then(r => r.json());
```

- [ ] **Step 4: Pass gameId to resolve-hot-potato**

Find:
```typescript
        await POST('/api/admin/powerup/resolve-hot-potato');
        // Refresh settings after resolution
        const freshSd = await POST('/api/settings').then(r => r.json());
```
→
```typescript
        await POST('/api/admin/powerup/resolve-hot-potato', { gameId });
        // Refresh settings after resolution
        const freshSd = await POST('/api/settings', { gameId }).then(r => r.json());
```

- [ ] **Step 5: Add super-admin customers tab to the tab bar**

Find the TABS section:
```typescript
          {activeGame.status === 'active' && (
            <button className={`admin-tab${tab === 'powerups' ? ' active' : ''}`} onClick={() => setTab('powerups')}>⚡ Power-ups</button>
          )}
```
Add after it:
```typescript
          {isSuperAdmin && (
            <button className={`admin-tab${tab === 'customers' ? ' active' : ''}`} onClick={() => { setTab('customers'); loadCustomers(); }}>👥 Customers</button>
          )}
```

- [ ] **Step 6: Add loadCustomers function and customers tab render**

Add the `loadCustomers` function after `activatePowerup`:
```typescript
  async function loadCustomers() {
    const res = await POST('/api/admin/superadmin/users');
    const data = await res.json();
    if (data.users) setCustomers(data.users);
  }
```

Add the customers tab render after the powerups tab render (before the closing `</div>` of the container):
```typescript
        {/* CUSTOMERS — super-admin only */}
        {tab === 'customers' && isSuperAdmin && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Customers</h2>
              <span className="badge">{customers.length} accounts</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {customers.length === 0 && (
                <div className="empty-state">No customers yet.</div>
              )}
              {customers.map(c => (
                <div key={c.id} style={{
                  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px',
                  padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: c.is_super_admin ? 'var(--gold)' : 'var(--text)' }}>
                      {c.email}{c.is_super_admin ? ' ⭐' : ''}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
                      Joined {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {c.last_sign_in_at && ` · Last login ${new Date(c.last_sign_in_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--accent)' }}>{c.game_count}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>game{c.game_count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
```

- [ ] **Step 7: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add auth token to admin API calls, signOut, super-admin customers tab"
```

---

## Task 14: Delete old admin login route

**Files:**
- Delete: `app/api/admin/login/route.ts`

- [ ] **Step 1: Delete the file**

```bash
rm /Users/signevallin/Desktop/GameOn/app/api/admin/login/route.ts
```

- [ ] **Step 2: Remove ADMIN_PASSWORD from .env (if set)**

Open `.env.local` and remove the line:
```
ADMIN_PASSWORD=...
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove legacy admin password login route"
```

---

## Task 15: Build check + deploy

- [ ] **Step 1: Run TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -40
```
Expected: no errors (or only pre-existing unrelated warnings).

- [ ] **Step 2: Deploy to production**

```bash
npx vercel deploy --prod 2>&1 | grep -E "(Error|✓|Aliased|https://)" | tail -6
```
Expected: `✓ Compiled successfully` and `▲ Aliased https://game-on-smoky.vercel.app`

- [ ] **Step 3: Smoke test**
  1. Open the app → click Admin → Register with your email → verify you land in the admin dashboard
  2. Go to Supabase dashboard → Authentication → Users → set `app_metadata: {"role": "superadmin"}` on your account
  3. Reload the app → verify the "Customers" tab appears in the admin dashboard
  4. Create a game → verify it appears only for your account
  5. Log out → log back in → verify session is restored
  6. Open in a new browser / incognito → log in as a team with an existing game key → verify teams still work normally

- [ ] **Step 4: Run the back-fill SQL if not done in Task 1**

```sql
UPDATE games
SET user_id = (SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com')
WHERE user_id IS NULL;
```
