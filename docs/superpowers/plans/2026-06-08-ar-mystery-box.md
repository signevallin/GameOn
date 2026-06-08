# AR Mystery Box Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins drop a virtual mystery box via AR mid-game; all teams race to open it first and win a random power-up as a bonus charge that bypasses the "already used" restriction.

**Architecture:** New `mystery_box` jsonb column on `games` (mirrors the existing `hot_potato` pattern) and `extra_powerups text[]` on `teams`. Two new API routes handle admin broadcast and team claim. A `MysteryBoxAR` component wraps the WebXR session with a 2D fallback. AdminScreen and MissionsScreen each get a small UI addition; `team/powerup` route learns about extra charges.

**Tech Stack:** Next.js App Router, Supabase (service-role client), WebXR Device API (`immersive-ar` + `hit-test` + `dom-overlay`), React, i18next

---

## File map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `docs/sql/2026-06-08-ar-mystery-box.sql` | DB migration |
| Modify | `lib/supabase.ts` | Add `mystery_box` to `Game`, `extra_powerups` to `Team` |
| Modify | `app/api/settings/route.ts` | Return `mystery_box` field |
| Create | `app/api/admin/mystery-box/route.ts` | Create box + expire |
| Create | `app/api/team/mystery-box/claim/route.ts` | First-come-first-served claim |
| Modify | `app/api/team/powerup/route.ts` | Honour `extra_powerups` bypass |
| Create | `components/MysteryBoxAR.tsx` | WebXR placement + claim UI |
| Modify | `components/screens/AdminScreen.tsx` | Button, countdown, AR overlay |
| Modify | `components/screens/MissionsScreen.tsx` | Mystery-box notification banner |
| Modify | `components/screens/TeamPowerupsScreen.tsx` | Show extra charges |
| Modify | `messages/en.json` | New notification keys |
| Modify | `messages/sv.json` | Swedish translations |
| Modify | `messages/no.json` | Norwegian translations |
| Modify | `messages/da.json` | Danish translations |
| Modify | `messages/de.json` | German translations |
| Modify | `messages/fr.json` | French translations |

---

### Task 1: DB migration + type updates

**Files:**
- Create: `docs/sql/2026-06-08-ar-mystery-box.sql`
- Modify: `lib/supabase.ts`

- [ ] **Step 1: Write the SQL file**

```sql
-- docs/sql/2026-06-08-ar-mystery-box.sql

-- 1. mystery_box column on games
ALTER TABLE games ADD COLUMN mystery_box jsonb DEFAULT NULL;

-- 2. extra_powerups column on teams (power-up charges earned from mystery boxes)
ALTER TABLE teams ADD COLUMN extra_powerups text[] NOT NULL DEFAULT '{}';
```

- [ ] **Step 2: Apply via Supabase MCP**

Use the Supabase MCP `apply_migration` tool with project `rbkpcnzrimicwzqwvgub`, name `ar_mystery_box`, and the SQL above.

Expected: migration applied without error.

- [ ] **Step 3: Update `lib/supabase.ts` — add `mystery_box` to `Game` and `extra_powerups` to `Team`**

In `lib/supabase.ts`, modify the `Game` type to add after the `hot_potato` field:

```typescript
  mystery_box?: {
    created_at: string;
    expires_at: string;
    claimed_by: string | null;
  } | null;
```

Modify the `Team` type to add after `powerups_received`:

```typescript
  extra_powerups: string[];
```

Full updated `lib/supabase.ts`:

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
};
```

- [ ] **Step 4: Commit**

```bash
git add docs/sql/2026-06-08-ar-mystery-box.sql lib/supabase.ts
git commit -m "feat: add mystery_box and extra_powerups DB columns + types"
```

---

### Task 2: Settings route + Admin mystery-box route

**Files:**
- Modify: `app/api/settings/route.ts`
- Create: `app/api/admin/mystery-box/route.ts`

- [ ] **Step 1: Update `app/api/settings/route.ts` to return `mystery_box`**

Change both `select('powerups_used, hot_potato')` calls to `select('powerups_used, hot_potato, mystery_box')` and add `mystery_box: data.mystery_box ?? null` to both response objects.

Full updated file:

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
    .select('powerups_used, hot_potato, mystery_box')
    .eq('id', gameId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });

  return NextResponse.json({
    powerups_used: data.powerups_used ?? [],
    hot_potato: data.hot_potato ?? null,
    mystery_box: data.mystery_box ?? null,
  });
}

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const { data, error } = await getSupabase()
    .from('games')
    .select('powerups_used, hot_potato, mystery_box')
    .eq('id', gameId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });

  return NextResponse.json({
    powerups_used: data.powerups_used ?? [],
    hot_potato: data.hot_potato ?? null,
    mystery_box: data.mystery_box ?? null,
  });
}
```

- [ ] **Step 2: Create `app/api/admin/mystery-box/route.ts`**

```typescript
// app/api/admin/mystery-box/route.ts
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

  const body = await req.json();
  const { gameId, action } = body;
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const supabase = getSupabase();

  // ── EXPIRE ────────────────────────────────────────────────────────────────────
  if (action === 'expire') {
    const { data: game } = await supabase
      .from('games').select('mystery_box').eq('id', gameId).single();

    if (!game?.mystery_box) return NextResponse.json({ ok: true, status: 'no_active' });

    await supabase.from('games').update({ mystery_box: null }).eq('id', gameId);

    const { data: allTeams } = await supabase
      .from('teams').select('id').eq('game_id', gameId);
    if (allTeams) {
      for (const t of allTeams) {
        await supabase.from('teams').update({
          pending_notification: {
            type: 'mystery_box_expired',
            msgKey: 'mystery_box_expired_msg',
            params: {},
          },
        }).eq('id', t.id);
      }
    }
    return NextResponse.json({ ok: true, status: 'expired' });
  }

  // ── CREATE ────────────────────────────────────────────────────────────────────
  const { data: game, error: gameErr } = await supabase
    .from('games').select('status, mystery_box').eq('id', gameId).single();

  if (gameErr || !game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
  if (game.status !== 'active') return NextResponse.json({ error: 'Game is not active.' }, { status: 400 });
  if (game.mystery_box) return NextResponse.json({ error: 'A mystery box is already active.' }, { status: 409 });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 1000).toISOString();
  const mysteryBox = { created_at: now.toISOString(), expires_at: expiresAt, claimed_by: null };

  await supabase.from('games').update({ mystery_box: mysteryBox }).eq('id', gameId);

  const { data: allTeams } = await supabase
    .from('teams').select('id').eq('game_id', gameId);
  if (allTeams) {
    for (const t of allTeams) {
      await supabase.from('teams').update({
        pending_notification: {
          type: 'mystery_box',
          msgKey: 'mystery_box_msg',
          params: { expiresAt },
        },
      }).eq('id', t.id);
    }
  }

  return NextResponse.json({ ok: true, expiresAt });
}
```

- [ ] **Step 3: Verify with curl (game must be active)**

```bash
# Replace TOKEN and GAME_ID with real values
curl -s -X POST http://localhost:3000/api/admin/mystery-box \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"gameId":"GAME_ID"}' | jq .
```

Expected: `{ "ok": true, "expiresAt": "..." }`
Expected on duplicate: `{ "error": "A mystery box is already active." }` with status 409.

- [ ] **Step 4: Commit**

```bash
git add app/api/settings/route.ts app/api/admin/mystery-box/route.ts
git commit -m "feat: add mystery-box admin route and settings mystery_box field"
```

---

### Task 3: Team claim route

**Files:**
- Create: `app/api/team/mystery-box/claim/route.ts`

- [ ] **Step 1: Create the directory and route file**

```typescript
// app/api/team/mystery-box/claim/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const POWERUP_POOL = [
  'shield', 'freeze', 'double_trouble', 'all_in', 'point_steal', 'robin_hood',
] as const;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { teamId } = body ?? {};
  if (!teamId) return NextResponse.json({ error: 'Missing teamId.' }, { status: 400 });

  const supabase = getSupabase();

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('id, name, game_id, extra_powerups')
    .eq('id', teamId)
    .single();
  if (teamErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('mystery_box')
    .eq('id', team.game_id)
    .single();
  if (gameErr || !game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });

  const mb = game.mystery_box as {
    created_at: string;
    expires_at: string;
    claimed_by: string | null;
  } | null;

  if (!mb) {
    return NextResponse.json({ error: 'No active mystery box.', code: 'expired' }, { status: 409 });
  }
  if (new Date() > new Date(mb.expires_at)) {
    return NextResponse.json({ error: 'Mystery box expired.', code: 'expired' }, { status: 409 });
  }
  if (mb.claimed_by !== null) {
    return NextResponse.json({ error: 'Already claimed.', code: 'already_claimed' }, { status: 409 });
  }

  // Assign random power-up and mark claimed
  const powerup = POWERUP_POOL[Math.floor(Math.random() * POWERUP_POOL.length)];

  await supabase.from('games').update({
    mystery_box: { ...mb, claimed_by: teamId },
  }).eq('id', team.game_id);

  const extraPowerups: string[] = team.extra_powerups ?? [];
  await supabase.from('teams').update({
    extra_powerups: [...extraPowerups, powerup],
    pending_notification: {
      type: 'mystery_box_won',
      msgKey: 'mystery_box_won_msg',
      params: { powerup: powerup.replace(/_/g, ' ') },
    },
  }).eq('id', teamId);

  // Notify all other teams
  const { data: allTeams } = await supabase
    .from('teams').select('id').eq('game_id', team.game_id).neq('id', teamId);
  if (allTeams) {
    for (const t of allTeams) {
      await supabase.from('teams').update({
        pending_notification: {
          type: 'mystery_box_taken',
          msgKey: 'mystery_box_taken_msg',
          params: { team: team.name },
        },
      }).eq('id', t.id);
    }
  }

  return NextResponse.json({ ok: true, powerup });
}
```

- [ ] **Step 2: Verify with curl**

```bash
curl -s -X POST http://localhost:3000/api/team/mystery-box/claim \
  -H "Content-Type: application/json" \
  -d '{"teamId":"TEAM_ID"}' | jq .
```

Expected (first call, box active): `{ "ok": true, "powerup": "freeze" }` (random type).
Expected (second call): `{ "error": "Already claimed.", "code": "already_claimed" }` with 409.
Expected (no active box): `{ "error": "No active mystery box.", "code": "expired" }` with 409.

- [ ] **Step 3: Commit**

```bash
git add app/api/team/mystery-box/claim/route.ts
git commit -m "feat: add team mystery-box claim route"
```

---

### Task 4: Update team powerup route for extra_powerups

**Files:**
- Modify: `app/api/team/powerup/route.ts`

The existing route checks `usedPowerups.includes(type)` and blocks reuse. We need to bypass this check if the power-up exists in `extra_powerups`, and consume one charge instead of adding to `team_powerups_used`.

- [ ] **Step 1: Add `markPowerupUsed` helper and update the used-check**

In `app/api/team/powerup/route.ts`, after the existing `const usedPowerups: string[] = sender.team_powerups_used ?? [];` line, add:

```typescript
const extraPowerups: string[] = sender.extra_powerups ?? [];
const hasExtra = extraPowerups.includes(type);

if (usedPowerups.includes(type) && !hasExtra) {
  return NextResponse.json({ error: 'You have already used this power-up.' }, { status: 409 });
}
```

Add this helper function near the top of the file (before the `POST` export):

```typescript
function markPowerupUsed(
  type: string,
  usedPowerups: string[],
  extraPowerups: string[],
  hasExtra: boolean
): Record<string, unknown> {
  if (hasExtra) {
    const idx = extraPowerups.indexOf(type);
    return {
      extra_powerups: [
        ...extraPowerups.slice(0, idx),
        ...extraPowerups.slice(idx + 1),
      ],
    };
  }
  return { team_powerups_used: [...usedPowerups, type] };
}
```

- [ ] **Step 2: Replace every `team_powerups_used: [...usedPowerups, type]` spread with `markPowerupUsed(...)`**

There are five occurrences to replace. Each pattern looks like:

```typescript
team_powerups_used: [...usedPowerups, type],
```

Replace each with:

```typescript
...markPowerupUsed(type, usedPowerups, extraPowerups, hasExtra),
```

The five locations are:
1. Inside the `shield` block: `await supabase.from('teams').update({ active_effects: ..., team_powerups_used: [...usedPowerups, type], pending_notification: ... })`
2. Inside `all_in` win branch: `await supabase.from('teams').update({ team_powerups_used: [...usedPowerups, type] }).eq('id', senderTeamId);`
3. Inside `all_in` lose branch: same pattern.
4. Inside `point_steal`: `await supabase.from('teams').update({ score: ..., team_powerups_used: [...usedPowerups, type], pending_notification: ... })`
5. Inside `robin_hood`: `await supabase.from('teams').update({ team_powerups_used: [...usedPowerups, type], pending_notification: ... })`
6. The final fallthrough `update` at the very end of the function: `await supabase.from('teams').update({ team_powerups_used: [...usedPowerups, type] })`

After edits the shield block becomes:
```typescript
if (type === 'shield') {
  const shieldUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const effects = sender.active_effects ?? {};
  await supabase.from('teams').update({
    active_effects: { ...effects, shield_until: shieldUntil },
    ...markPowerupUsed(type, usedPowerups, extraPowerups, hasExtra),
    pending_notification: { type: 'powerup_self', msgKey: 'shield_msg', params: {} },
  }).eq('id', senderTeamId);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Verify with curl — blocked reuse**

```bash
# Use a team that has already used 'freeze'. Should fail normally.
curl -s -X POST http://localhost:3000/api/team/powerup \
  -H "Content-Type: application/json" \
  -d '{"type":"freeze","senderTeamId":"TEAM_ID","targetTeamId":"OTHER_TEAM_ID"}' | jq .
```

Expected (team has used freeze, no extra): `{ "error": "You have already used this power-up." }` 409.

To test extra bypass: manually set `extra_powerups = '{"freeze"}'` on the team row in Supabase dashboard, then retry — should succeed and remove one `freeze` from `extra_powerups`.

- [ ] **Step 4: Commit**

```bash
git add app/api/team/powerup/route.ts
git commit -m "feat: support extra_powerups bypass in team powerup route"
```

---

### Task 5: MysteryBoxAR component

**Files:**
- Create: `components/MysteryBoxAR.tsx`

This component handles both the admin placement flow (`mode='place'`) and the team claim flow (`mode='claim'`). It opens a WebXR `immersive-ar` session with `hit-test` + `dom-overlay`. If WebXR is unavailable, it shows a fullscreen 2D fallback.

- [ ] **Step 1: Create `components/MysteryBoxAR.tsx`**

```typescript
'use client';
import { useEffect, useRef, useState } from 'react';

type Props = {
  mode: 'place' | 'claim';
  onPlace?: () => void;
  onClaim?: (result: 'won' | 'taken' | 'expired') => void;
  teamId?: string;
  onClose: () => void;
};

const POWERUP_ICONS: Record<string, string> = {
  shield: '🛡️',
  freeze: '❄️',
  double_trouble: '😈',
  all_in: '🎲',
  point_steal: '🎰',
  robin_hood: '🏹',
};

export default function MysteryBoxAR({ mode, onPlace, onClaim, teamId, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<XRSession | null>(null);

  const [arSupported, setArSupported] = useState<boolean | null>(null);
  const [arActive, setArActive] = useState(false);
  const [hasHit, setHasHit] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<{ type: 'won' | 'taken' | 'expired'; powerup?: string } | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.xr) {
      setArSupported(false);
      return;
    }
    navigator.xr.isSessionSupported('immersive-ar')
      .then(setArSupported)
      .catch(() => setArSupported(false));
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current?.end().catch(() => {});
    };
  }, []);

  async function startAR() {
    if (!navigator.xr || !overlayRef.current) return;
    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        domOverlay: { root: overlayRef.current },
      } as XRSessionInit);
      sessionRef.current = session;

      // Minimal WebGL context required by the AR session
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl', { xrCompatible: true }) as
        WebGLRenderingContext & { makeXRCompatible: () => Promise<void> };
      await gl.makeXRCompatible();
      session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

      const refSpace = await session.requestReferenceSpace('local');
      const viewerSpace = await session.requestReferenceSpace('viewer');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let hitSource: XRHitTestSource | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hitSource = await (session as any).requestHitTestSource({ space: viewerSpace });
      } catch {
        /* hit-test optional — box stays centered */
      }

      session.addEventListener('end', () => {
        hitSource?.cancel();
        sessionRef.current = null;
        setArActive(false);
        setHasHit(false);
      });

      setArActive(true);

      function frame(_time: number, xrFrame: XRFrame) {
        if (!sessionRef.current) return;
        session.requestAnimationFrame(frame);
        if (hitSource) {
          const hits = xrFrame.getHitTestResults(hitSource);
          setHasHit(hits.length > 0);
        } else {
          setHasHit(true);
        }
        // We only use the hit test for show/hide logic.
        // The box is displayed via DOM overlay at a fixed position.
        void refSpace; // consumed to avoid unused-var lint warning
      }
      session.requestAnimationFrame(frame);
    } catch {
      setArSupported(false);
    }
  }

  async function handleAction() {
    if (claiming) return;
    if (mode === 'place') {
      await sessionRef.current?.end().catch(() => {});
      onPlace?.();
      return;
    }
    setClaiming(true);
    await sessionRef.current?.end().catch(() => {});
    try {
      const res = await fetch('/api/team/mystery-box/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ type: 'won', powerup: data.powerup });
        setTimeout(() => onClaim?.('won'), 2500);
      } else if (res.status === 409 && data.code === 'already_claimed') {
        setResult({ type: 'taken' });
        setTimeout(() => onClaim?.('taken'), 2000);
      } else {
        setResult({ type: 'expired' });
        setTimeout(() => onClaim?.('expired'), 2000);
      }
    } catch {
      setResult({ type: 'expired' });
      setTimeout(() => onClaim?.('expired'), 2000);
    } finally {
      setClaiming(false);
    }
  }

  const overlayStyles: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 2000,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '24px',
  };

  // Result screen
  if (result) {
    return (
      <div style={{ ...overlayStyles, background: 'rgba(0,0,0,0.92)' }}>
        {result.type === 'won' && (
          <>
            <div style={{ fontSize: '80px', animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>🎁</div>
            <div style={{ fontWeight: 800, fontSize: '24px', color: 'var(--gold)', letterSpacing: '2px' }}>YOU GOT IT!</div>
            <div style={{ fontSize: '56px' }}>{POWERUP_ICONS[result.powerup ?? ''] ?? '⚡'}</div>
            <div style={{ fontSize: '15px', color: 'var(--muted)', textAlign: 'center' }}>
              +1 <strong style={{ color: 'var(--text)' }}>{result.powerup?.replace(/_/g, ' ').toUpperCase()}</strong> charge
            </div>
          </>
        )}
        {result.type === 'taken' && (
          <>
            <div style={{ fontSize: '72px' }}>💨</div>
            <div style={{ fontWeight: 800, fontSize: '22px', color: 'var(--accent2)' }}>TOO SLOW!</div>
            <div style={{ fontSize: '14px', color: 'var(--muted)' }}>Another team grabbed it first</div>
          </>
        )}
        {result.type === 'expired' && (
          <>
            <div style={{ fontSize: '72px' }}>⏰</div>
            <div style={{ fontWeight: 800, fontSize: '22px', color: 'var(--muted)' }}>DISAPPEARED</div>
            <div style={{ fontSize: '14px', color: 'var(--muted)' }}>The box vanished…</div>
          </>
        )}
      </div>
    );
  }

  // Close button (shared)
  const closeBtn = (
    <button
      onClick={() => { sessionRef.current?.end().catch(() => {}); onClose(); }}
      style={{
        position: 'absolute', top: '24px', right: '24px',
        background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '50%', width: '40px', height: '40px',
        color: '#fff', fontSize: '18px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Sora', sans-serif",
      }}
    >✕</button>
  );

  // 2D fallback
  if (arSupported === false) {
    return (
      <div style={{ ...overlayStyles, background: 'rgba(0,0,0,0.92)' }}>
        {closeBtn}
        <div style={{ fontSize: '96px', animation: 'float 2s ease-in-out infinite' }}>📦</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', maxWidth: '260px' }}>
          AR not supported on this device
        </div>
        {mode === 'place' && (
          <button className="btn btn-primary" onClick={() => onPlace?.()} style={{ fontSize: '16px', padding: '14px 32px' }}>
            📦 Place Box Here
          </button>
        )}
        {mode === 'claim' && (
          <button
            className="btn btn-primary"
            onClick={handleAction}
            disabled={claiming}
            style={{ fontSize: '16px', padding: '14px 32px', background: 'var(--gold)', borderColor: 'var(--gold)', color: '#000' }}
          >
            {claiming ? '...' : '📦 TAP TO OPEN!'}
          </button>
        )}
      </div>
    );
  }

  // Pre-AR launch screen
  if (!arActive) {
    return (
      <div style={{ ...overlayStyles, background: 'rgba(0,0,0,0.92)' }}>
        {closeBtn}
        <div style={{ fontSize: '80px', animation: 'float 2s ease-in-out infinite' }}>📦</div>
        {arSupported === null ? (
          <div style={{ color: 'var(--muted)', fontSize: '14px' }}>Checking AR support…</div>
        ) : (
          <>
            <div style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center', maxWidth: '260px' }}>
              {mode === 'place'
                ? 'Open AR camera, point at a surface, then tap to place the box'
                : 'Open AR camera and tap the box to claim it!'}
            </div>
            <button className="btn btn-primary" onClick={startAR} style={{ fontSize: '16px', padding: '14px 32px' }}>
              📷 Open AR Camera
            </button>
          </>
        )}
      </div>
    );
  }

  // AR active — DOM overlay (camera passthrough provided by WebXR)
  return (
    <div ref={overlayRef} style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
      {/* Surface reticle */}
      {hasHit && (
        <div style={{
          position: 'absolute', bottom: '32%', left: '50%', transform: 'translateX(-50%)',
          width: '64px', height: '14px',
          background: 'rgba(117,171,200,0.45)',
          borderRadius: '50%', filter: 'blur(3px)',
        }} />
      )}

      {/* Mystery box */}
      {hasHit && (
        <div
          onClick={mode === 'claim' ? handleAction : undefined}
          style={{
            position: 'absolute', bottom: '33%', left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '88px',
            cursor: mode === 'claim' ? 'pointer' : 'default',
            animation: 'float 2s ease-in-out infinite',
            userSelect: 'none', WebkitUserSelect: 'none',
          }}
        >📦</div>
      )}

      {/* Confirm button (place mode) */}
      {mode === 'place' && hasHit && (
        <button
          className="btn btn-primary"
          onClick={handleAction}
          style={{
            position: 'absolute', bottom: '48px', left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '16px', padding: '14px 32px', minWidth: '200px',
          }}
        >
          📦 Placera här
        </button>
      )}

      {/* Scan hint */}
      {!hasHit && (
        <div style={{
          position: 'absolute', bottom: '48px', left: '50%', transform: 'translateX(-50%)',
          color: '#fff', fontSize: '14px', textAlign: 'center',
          background: 'rgba(0,0,0,0.55)', padding: '10px 20px', borderRadius: '10px',
          whiteSpace: 'nowrap',
        }}>
          Point camera at a flat surface…
        </div>
      )}

      {/* Tap hint (claim mode) */}
      {mode === 'claim' && hasHit && (
        <div style={{
          position: 'absolute', bottom: '48px', left: '50%', transform: 'translateX(-50%)',
          color: 'var(--gold)', fontSize: '15px', fontWeight: 800,
          background: 'rgba(0,0,0,0.65)', padding: '10px 20px', borderRadius: '10px',
          pointerEvents: 'none', animation: 'pulse 0.8s ease-in-out infinite',
        }}>
          TAP THE BOX!
        </div>
      )}

      {/* Close */}
      <button
        onClick={() => { sessionRef.current?.end().catch(() => {}); onClose(); }}
        style={{
          position: 'absolute', top: '24px', right: '24px',
          background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '50%', width: '40px', height: '40px',
          color: '#fff', fontSize: '18px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Sora', sans-serif",
        }}
      >✕</button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it imports without TypeScript errors**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep MysteryBoxAR
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add components/MysteryBoxAR.tsx
git commit -m "feat: add MysteryBoxAR component with WebXR + 2D fallback"
```

---

### Task 6: AdminScreen UI

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

Add: `mysteryBoxActive` state, `useMysteryBoxCountdown` hook, polling update, AR Mystery Box button + countdown, AR placement overlay.

- [ ] **Step 1: Add `MysteryBoxState` type and `useMysteryBoxCountdown` hook near the top of AdminScreen.tsx (after the `HotPotatoState` type and `useHotPotatoCountdown` hook, around line 62)**

After the `useHotPotatoCountdown` hook, add:

```typescript
type MysteryBoxState = {
  created_at: string;
  expires_at: string;
  claimed_by: string | null;
} | null;

function useMysteryBoxCountdown(mb: MysteryBoxState) {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!mb || mb.claimed_by !== null) { setSecsLeft(null); return; }
    const endTime = new Date(mb.expires_at).getTime();
    const tick = () => setSecsLeft(Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mb]);
  return secsLeft;
}
```

- [ ] **Step 2: Add `mysteryBoxActive` state and `showMysteryBoxAR` state near the other state declarations (around line 402)**

After the `hotPotatoActive` state line, add:

```typescript
const [mysteryBoxActive, setMysteryBoxActive] = useState<MysteryBoxState>(null);
const [showMysteryBoxAR, setShowMysteryBoxAR] = useState(false);
const [mysteryBoxLoading, setMysteryBoxLoading] = useState(false);
```

- [ ] **Step 3: Wire up `useMysteryBoxCountdown` near the `hotPotatoSecondsLeft` line**

After the `hotPotatoSecondsLeft` constant (around line 105), add:

```typescript
const mysteryBoxSecsLeft = useMysteryBoxCountdown(mysteryBoxActive);
```

- [ ] **Step 4: Update the poll function to read `mystery_box` from settings and auto-expire**

In the `poll()` function inside the `useEffect` (after the hot potato auto-resolve block, around line 643), add:

```typescript
      const mb = sd.mystery_box ?? null;
      setMysteryBoxActive(mb);

      // Auto-expire mystery box when countdown reaches 0
      if (mb && mb.claimed_by === null && new Date(mb.expires_at) <= new Date()) {
        await postWithAuth('/api/admin/mystery-box', { gameId, action: 'expire' });
        const freshSd = await postWithAuth('/api/settings', { gameId }).then(r => r.json());
        setMysteryBoxActive(freshSd.mystery_box ?? null);
      }
```

Also update `loadGameData` (around line 566) — after `setHotPotatoActive(sd.hot_potato ?? null);` add:

```typescript
    setMysteryBoxActive(sd.mystery_box ?? null);
```

- [ ] **Step 5: Add `launchMysteryBox` function after the `onHotPotato` function (around line 790)**

```typescript
  async function launchMysteryBox() {
    if (!activeGame) return;
    setShowMysteryBoxAR(true);
  }

  async function onMysteryBoxPlaced() {
    if (!activeGame) return;
    setShowMysteryBoxAR(false);
    setMysteryBoxLoading(true);
    try {
      const res = await fetch('/api/admin/mystery-box', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ gameId: activeGame.id }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) {
        setMysteryBoxActive({ created_at: new Date().toISOString(), expires_at: data.expiresAt, claimed_by: null });
      }
    } finally {
      setMysteryBoxLoading(false);
    }
  }
```

- [ ] **Step 6: Add the AR Mystery Box button + status + overlay in the dashboard view**

Find the area in the JSX where the Hot Potato card is rendered (around line 250 — it has `background: hotPotatoActive ? ...`). Immediately after the closing `</div>` of that card, add the Mystery Box card:

```tsx
        {/* ── MYSTERY BOX ───────────────────────────────────── */}
        <div style={{
          background: mysteryBoxActive && mysteryBoxActive.claimed_by === null
            ? 'rgba(222,187,107,0.08)' : 'var(--card)',
          border: `1px solid ${mysteryBoxActive && mysteryBoxActive.claimed_by === null
            ? 'rgba(222,187,107,0.6)' : 'var(--border)'}`,
          borderRadius: '12px', padding: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '22px' }}>🎁</span>
            <div style={{ fontSize: '14px', fontWeight: 800, color: mysteryBoxActive && mysteryBoxActive.claimed_by === null ? 'var(--gold)' : 'var(--text)' }}>
              AR Mystery Box
            </div>
            {mysteryBoxActive && mysteryBoxActive.claimed_by === null && mysteryBoxSecsLeft !== null && (
              <span style={{
                marginLeft: 'auto',
                fontSize: '13px', fontWeight: 800,
                color: mysteryBoxSecsLeft <= 30 ? 'var(--accent2)' : 'var(--gold)',
                background: 'rgba(222,187,107,0.15)',
                padding: '3px 10px', borderRadius: '20px',
              }}>
                ⏱ {fmtTimer(mysteryBoxSecsLeft)}
              </span>
            )}
          </div>

          {mysteryBoxActive && mysteryBoxActive.claimed_by === null ? (
            <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
              Box is live — teams are racing to open it!
            </p>
          ) : mysteryBoxActive?.claimed_by ? (
            <p style={{ fontSize: '12px', color: 'var(--accent3)', margin: 0 }}>
              ✓ Claimed by a team
            </p>
          ) : (
            <button
              className="btn btn-primary"
              style={{ width: '100%', background: 'var(--gold)', borderColor: 'var(--gold)', color: '#000' }}
              disabled={mysteryBoxLoading || activeGame?.status !== 'active'}
              onClick={launchMysteryBox}
            >
              {mysteryBoxLoading ? '...' : '🎁 Drop AR Mystery Box'}
            </button>
          )}
        </div>
```

- [ ] **Step 7: Add the AR overlay just before the closing return tag (after all other overlays)**

In the JSX return, after the hot potato overlay (or any other full-screen overlay), add:

```tsx
        {showMysteryBoxAR && (
          <MysteryBoxAR
            mode="place"
            onPlace={onMysteryBoxPlaced}
            onClose={() => setShowMysteryBoxAR(false)}
          />
        )}
```

- [ ] **Step 8: Add the import for MysteryBoxAR at the top of AdminScreen.tsx**

After the existing component imports, add:

```typescript
import MysteryBoxAR from '@/components/MysteryBoxAR';
```

- [ ] **Step 9: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "AdminScreen|MysteryBox" | head -20
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add AR mystery box button and countdown to admin dashboard"
```

---

### Task 7: Team UI — MissionsScreen + TeamPowerupsScreen

**Files:**
- Modify: `components/screens/MissionsScreen.tsx`
- Modify: `components/screens/TeamPowerupsScreen.tsx`

**MissionsScreen:** Handle `mystery_box` notification as a special countdown banner instead of the standard `NotificationOverlay`. Add `mystery_box_won`, `mystery_box_taken`, `mystery_box_expired` to the `NotificationOverlay` CONFIG.

**TeamPowerupsScreen:** Show power-ups that have an extra charge as available even if already used.

- [ ] **Step 1: Add mystery_box notification types to NotificationOverlay CONFIG in MissionsScreen.tsx**

In the `CONFIG` object inside `NotificationOverlay` (around line 96), add these entries:

```typescript
    mystery_box_won:     { emoji: '🎁', title: t('notifications.mystery_box_won'),     btnLabel: t('notifications.btn_letsGo'), color: 'var(--gold)'    },
    mystery_box_taken:   { emoji: '💨', title: t('notifications.mystery_box_taken'),   btnLabel: t('notifications.btn_damnIt'), color: 'var(--accent2)' },
    mystery_box_expired: { emoji: '⏰', title: t('notifications.mystery_box_expired'), btnLabel: t('notifications.btn_ok'),     color: 'var(--muted)'   },
```

- [ ] **Step 2: Add `showMysteryBoxAR` state and `mysteryBoxExpiresAt` ref in MissionsScreen**

Inside the `MissionsScreen` function, near the other `useState` declarations, add:

```typescript
  const [showMysteryBoxAR, setShowMysteryBoxAR] = useState(false);
  const mysteryBoxExpiresAtRef = useRef<number>(0);
  const [mysteryBoxSecsLeft, setMysteryBoxSecsLeft] = useState(0);
```

- [ ] **Step 3: Add countdown effect for mystery_box notification**

After the existing `useEffect` that sets notification (around line 598), add:

```typescript
  // Drive countdown for mystery_box banner
  useEffect(() => {
    if (!notification || notification.type !== 'mystery_box') return;
    const expiresAt = notification.params?.expiresAt as string | undefined;
    mysteryBoxExpiresAtRef.current = expiresAt
      ? new Date(expiresAt).getTime()
      : Date.now() + 2 * 60 * 1000;

    const tick = () => {
      const secs = Math.max(0, Math.ceil((mysteryBoxExpiresAtRef.current - Date.now()) / 1000));
      setMysteryBoxSecsLeft(secs);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [notification]);
```

- [ ] **Step 4: Import MysteryBoxAR and fmtTimer in MissionsScreen**

At the top of `MissionsScreen.tsx`, add:

```typescript
import MysteryBoxAR from '@/components/MysteryBoxAR';
```

Add this helper near the top of the file (or co-locate with MissionsScreen):

```typescript
function fmtMins(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
```

- [ ] **Step 5: Replace the notification rendering block in the MissionsScreen JSX return**

Find:

```tsx
      {notification && (
        <NotificationOverlay
          notification={notification}
          teamId={team.id}
          onDismiss={() => setNotification(null)}
        />
      )}
```

Replace with:

```tsx
      {notification && notification.type === 'mystery_box' && !showMysteryBoxAR && (
        /* Mystery box countdown banner */
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '20px', padding: '32px',
        }}>
          <div style={{ fontSize: '72px', animation: 'float 2s ease-in-out infinite' }}>📦</div>
          <h2 style={{ color: 'var(--gold)', letterSpacing: '2px', textAlign: 'center' }}>
            MYSTERY BOX!
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center', maxWidth: '260px' }}>
            A mystery box appeared! Race to open it before other teams!
          </p>
          <div style={{
            fontSize: '36px', fontWeight: 800,
            color: mysteryBoxSecsLeft <= 30 ? 'var(--accent2)' : 'var(--gold)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            ⏱ {fmtMins(mysteryBoxSecsLeft)}
          </div>
          {mysteryBoxSecsLeft > 0 ? (
            <button
              className="btn btn-primary"
              style={{ fontSize: '16px', padding: '14px 32px', background: 'var(--gold)', borderColor: 'var(--gold)', color: '#000' }}
              onClick={() => setShowMysteryBoxAR(true)}
            >
              📷 Open AR Camera
            </button>
          ) : (
            <p style={{ color: 'var(--accent2)', fontSize: '14px' }}>Box expired ⏰</p>
          )}
          <button
            style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
            onClick={() => setNotification(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {notification && notification.type === 'mystery_box' && showMysteryBoxAR && (
        <MysteryBoxAR
          mode="claim"
          teamId={team.id}
          onClaim={(result) => {
            setShowMysteryBoxAR(false);
            setNotification(null);
            if (result === 'won') {
              // notification will arrive via poll as mystery_box_won
            }
          }}
          onClose={() => setShowMysteryBoxAR(false)}
        />
      )}

      {notification && notification.type !== 'mystery_box' && (
        <NotificationOverlay
          notification={notification}
          teamId={team.id}
          onDismiss={() => setNotification(null)}
        />
      )}
```

- [ ] **Step 6: Update TeamPowerupsScreen to show extra charges**

In `components/screens/TeamPowerupsScreen.tsx`, find:

```typescript
  const used = team.team_powerups_used ?? [];
```

Add after it:

```typescript
  const extra = team.extra_powerups ?? [];
```

Find:

```typescript
          const isUsed = used.includes(pu.id);
```

Replace with:

```typescript
          const isUsed = used.includes(pu.id) && !extra.includes(pu.id);
```

Find the "USED" label rendering:

```tsx
                {isUsed
                  ? <span style={{ fontSize: '12px', color: 'var(--muted)', flexShrink: 0 }}>{t('powerups.usedTag')}</span>
```

Add an EXTRA badge right after the existing `isUsed` check by modifying the label block:

```tsx
                {isUsed
                  ? <span style={{ fontSize: '12px', color: 'var(--muted)', flexShrink: 0 }}>{t('powerups.usedTag')}</span>
                  : extra.includes(pu.id)
                    ? <span style={{ fontSize: '11px', color: 'var(--gold)', background: 'rgba(222,187,107,0.15)', border: '1px solid rgba(222,187,107,0.4)', borderRadius: '20px', padding: '2px 8px', flexShrink: 0 }}>+1 EXTRA</span>
                    : <span style={{ fontSize: '16px', color: pu.color, flexShrink: 0 }}>{isSelected ? '▾' : '▸'}</span>
                }
```

- [ ] **Step 7: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "MissionsScreen|TeamPowerups|MysteryBox" | head -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/screens/MissionsScreen.tsx components/screens/TeamPowerupsScreen.tsx
git commit -m "feat: add mystery box banner, AR claim view, and extra charge badge"
```

---

### Task 8: i18n translations

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/sv.json`
- Modify: `messages/no.json`
- Modify: `messages/da.json`
- Modify: `messages/de.json`
- Modify: `messages/fr.json`

Add notification titles and message keys for all four mystery box notification types. The keys must be inside the `"notifications"` object.

- [ ] **Step 1: Update `messages/en.json`**

Inside the `"notifications"` object, after the `"hot_potato_penalty_msg"` line, add:

```json
    "mystery_box": "MYSTERY BOX!",
    "mystery_box_won": "YOU GOT IT!",
    "mystery_box_taken": "TOO SLOW!",
    "mystery_box_expired": "IT DISAPPEARED…",
    "mystery_box_msg": "A mystery box appeared! Race to open it!",
    "mystery_box_won_msg": "You got the mystery box! +1 {{powerup}} charge unlocked.",
    "mystery_box_taken_msg": "{{team}} grabbed the mystery box! 💨",
    "mystery_box_expired_msg": "The mystery box disappeared… no one was fast enough ⏰"
```

- [ ] **Step 2: Update `messages/sv.json`**

Inside the `"notifications"` object, add the same keys with Swedish text:

```json
    "mystery_box": "MYSTERY BOX!",
    "mystery_box_won": "DU FICK DEN!",
    "mystery_box_taken": "FÖR LÅNGSAMT!",
    "mystery_box_expired": "DEN FÖRSVANN…",
    "mystery_box_msg": "En mystery box dök upp! Tävla om att öppna den!",
    "mystery_box_won_msg": "Du fick mystery boxen! +1 {{powerup}}-laddning upplåst.",
    "mystery_box_taken_msg": "{{team}} tog mystery boxen! 💨",
    "mystery_box_expired_msg": "Mystery boxen försvann… ingen var snabb nog ⏰"
```

- [ ] **Step 3: Update `messages/no.json`**

Inside the `"notifications"` object, add:

```json
    "mystery_box": "MYSTERY BOX!",
    "mystery_box_won": "DU FIKK DEN!",
    "mystery_box_taken": "FOR SAKTE!",
    "mystery_box_expired": "DEN FORSVANT…",
    "mystery_box_msg": "En mystery box dukket opp! Kappløp om å åpne den!",
    "mystery_box_won_msg": "Du fikk mystery boksen! +1 {{powerup}}-ladning låst opp.",
    "mystery_box_taken_msg": "{{team}} tok mystery boksen! 💨",
    "mystery_box_expired_msg": "Mystery boksen forsvant… ingen var rask nok ⏰"
```

- [ ] **Step 4: Update `messages/da.json`**

Inside the `"notifications"` object, add:

```json
    "mystery_box": "MYSTERY BOX!",
    "mystery_box_won": "DU FIK DEN!",
    "mystery_box_taken": "FOR LANGSOM!",
    "mystery_box_expired": "DEN FORSVANDT…",
    "mystery_box_msg": "En mystery box dukkede op! Kap om at åbne den!",
    "mystery_box_won_msg": "Du fik mystery boksen! +1 {{powerup}}-opladning låst op.",
    "mystery_box_taken_msg": "{{team}} greb mystery boksen! 💨",
    "mystery_box_expired_msg": "Mystery boksen forsvandt… ingen var hurtig nok ⏰"
```

- [ ] **Step 5: Update `messages/de.json`**

Inside the `"notifications"` object, add:

```json
    "mystery_box": "MYSTERY BOX!",
    "mystery_box_won": "DU HAST SIE!",
    "mystery_box_taken": "ZU LANGSAM!",
    "mystery_box_expired": "SIE IST WEG…",
    "mystery_box_msg": "Eine Mystery Box ist aufgetaucht! Beeilt euch, sie zu öffnen!",
    "mystery_box_won_msg": "Du hast die Mystery Box! +1 {{powerup}}-Ladung freigeschaltet.",
    "mystery_box_taken_msg": "{{team}} hat die Mystery Box geschnappt! 💨",
    "mystery_box_expired_msg": "Die Mystery Box ist verschwunden… niemand war schnell genug ⏰"
```

- [ ] **Step 6: Update `messages/fr.json`**

Inside the `"notifications"` object, add:

```json
    "mystery_box": "MYSTERY BOX!",
    "mystery_box_won": "TU L'AS EU!",
    "mystery_box_taken": "TROP LENT!",
    "mystery_box_expired": "ELLE A DISPARU…",
    "mystery_box_msg": "Une mystery box est apparue! Dépêchez-vous de l'ouvrir!",
    "mystery_box_won_msg": "Tu as eu la mystery box! +1 charge {{powerup}} débloquée.",
    "mystery_box_taken_msg": "{{team}} a pris la mystery box! 💨",
    "mystery_box_expired_msg": "La mystery box a disparu… personne n'était assez rapide ⏰"
```

- [ ] **Step 7: Verify translations compile (no missing commas in JSON)**

```bash
for f in messages/en.json messages/sv.json messages/no.json messages/da.json messages/de.json messages/fr.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "$f OK"
done
```

Expected: each file prints `OK`.

- [ ] **Step 8: Commit**

```bash
git add messages/en.json messages/sv.json messages/no.json messages/da.json messages/de.json messages/fr.json
git commit -m "feat: add mystery box i18n keys to all 6 language files"
```

---

## Manual test checklist

After all tasks are complete, test end-to-end:

1. Start a game, open admin dashboard.
2. Verify "🎁 Drop AR Mystery Box" button appears when game is active.
3. Tap button → AR overlay opens. On a desktop without WebXR: fallback 2D view shows with "Place Box Here" button.
4. Tap "Place Box Here" (or "Placera här" in AR) → overlay closes, button changes to "Box is live".
5. On a team device: refresh — mystery box banner appears with countdown.
6. Tap "Open AR Camera" → AR claim view opens. Tap the box → claim request fires.
7. Winning team sees "YOU GOT IT!" + power-up icon. Other teams see "TOO SLOW!".
8. Open TeamPowerupsScreen → won power-up shows "+1 EXTRA" badge even if already used.
9. Use the power-up → extra charge is consumed, badge disappears on next poll.
10. Let a box expire without claiming → all teams see "IT DISAPPEARED…" notification.
