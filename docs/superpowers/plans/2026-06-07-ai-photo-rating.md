# AI Photo Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins choose AI or manual photo rating per game; photos are auto-rated by Claude Haiku when submitted if AI mode is on, with a live toggle and override capability in the admin panel.

**Architecture:** A shared `lib/ai-photo-rater.ts` utility calls Claude Haiku with vision. The player-facing photo submit routes (`/api/team/photo`, `/api/scavenger/submit`) check the game's `ai_photo_rating` flag and auto-rate inline if on. A new `PATCH /api/admin/game/[id]` route lets admin toggle AI mode live. The admin Photos tab gains a toggle, an info card, AI/manual badges on rated photos, and an override button. Re-rating existing submissions (AI override or manual change) is handled by adjusting the team score diff.

**Tech Stack:** Next.js App Router, TypeScript, Supabase PostgreSQL, Anthropic SDK (already installed), React hooks

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260607_ai_photo_rating.sql` | Create | Add columns to `games`, `photo_submissions`, `scavenger_submissions` |
| `lib/supabase.ts` | Modify | Add `ai_photo_rating`, `ai_photo_instructions` to `Game` type |
| `lib/ai-photo-rater.ts` | Create | Claude Haiku vision utility: `ratePhoto(params) → points` |
| `app/api/admin/game/[id]/route.ts` | Create | `PATCH` — update `ai_photo_rating` / `ai_photo_instructions` live |
| `app/api/admin/game/route.ts` | Modify | Accept `ai_photo_rating` + `ai_photo_instructions` on create |
| `app/api/admin/photos/rate/route.ts` | Modify | Fix re-rating score diff + set `ai_rated: false` on manual override |
| `app/api/scavenger/review/route.ts` | Modify | Fix re-rating score diff + set `ai_rated: false` on manual override |
| `app/api/team/photo/route.ts` | Modify | Trigger AI rating after insert if game has AI mode on |
| `app/api/scavenger/submit/route.ts` | Modify | Trigger AI rating after upsert if game has AI mode on |
| `components/screens/AdminScreen.tsx` | Modify | New state + UI: create-game toggle, Photos tab toggle, AI badges, override |

---

### Task 1: DB migration + type updates

**Files:**
- Create: `supabase/migrations/20260607_ai_photo_rating.sql`
- Modify: `lib/supabase.ts`
- Modify: `components/screens/AdminScreen.tsx` (two local type definitions only)

- [ ] **Step 1: Write migration file**

```sql
-- supabase/migrations/20260607_ai_photo_rating.sql

-- AI rating settings on games
alter table public.games
  add column if not exists ai_photo_rating boolean not null default false,
  add column if not exists ai_photo_instructions text;

-- Flag whether a photo was rated by AI or manually
alter table public.photo_submissions
  add column if not exists ai_rated boolean not null default false;

alter table public.scavenger_submissions
  add column if not exists ai_rated boolean not null default false;
```

- [ ] **Step 2: Apply migration**

Open the Supabase Dashboard → SQL Editor, paste the file contents and run it.

Or try:
```bash
cd /Users/signevallin/Desktop/GameOn && npx supabase db push
```

- [ ] **Step 3: Update `Game` type in `lib/supabase.ts`**

Find the `Game` type (around line 30). Add two fields after `hide_leaderboard?`:

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
};
```

- [ ] **Step 4: Update `PhotoSubmission` type in `AdminScreen.tsx`**

Find (line 346):
```typescript
type PhotoSubmission = {
  id: string; team_id: string; team_name: string;
  mission_id: string; photo_url: string; status: string;
  points_awarded: number | null; created_at: string;
};
```

Replace with:
```typescript
type PhotoSubmission = {
  id: string; team_id: string; team_name: string;
  mission_id: string; photo_url: string; status: string;
  points_awarded: number | null; ai_rated?: boolean; created_at: string;
};
```

- [ ] **Step 5: Update `ScavengerSubmission` type in `AdminScreen.tsx`**

Find (line 352):
```typescript
type ScavengerSubmission = {
  id: string; team_id: string; team_name: string;
  game_id: string; mission_id: string;
  item_id: string; item_label: string;
  photo_url: string; status: string;
  points_awarded: number | null; created_at: string;
};
```

Replace with:
```typescript
type ScavengerSubmission = {
  id: string; team_id: string; team_name: string;
  game_id: string; mission_id: string;
  item_id: string; item_label: string;
  photo_url: string; status: string;
  points_awarded: number | null; ai_rated?: boolean; created_at: string;
};
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260607_ai_photo_rating.sql lib/supabase.ts components/screens/AdminScreen.tsx
git commit -m "feat: add ai_photo_rating columns and update types"
```

---

### Task 2: AI photo rater utility

**Files:**
- Create: `lib/ai-photo-rater.ts`

- [ ] **Step 1: Create `lib/ai-photo-rater.ts`**

```typescript
// lib/ai-photo-rater.ts
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Mirrors getPointOptions() from AdminScreen — produces the same valid point
 * steps: [0, 20%, 40%, 60%, 80%, 100%] of maxPts (rounded to nearest 100).
 */
function getValidPoints(maxPts: number): number[] {
  const steps = 5;
  const step = Math.ceil(maxPts / steps / 100) * 100;
  const opts: number[] = [0];
  for (let i = 1; i <= steps; i++) {
    const v = Math.min(i * step, maxPts);
    if (!opts.includes(v)) opts.push(v);
  }
  if (!opts.includes(maxPts)) opts.push(maxPts);
  return opts;
}

function roundToNearest(value: number, opts: number[]): number {
  return opts.reduce((best, curr) =>
    Math.abs(curr - value) < Math.abs(best - value) ? curr : best
  );
}

/**
 * Rates a photo using Claude Haiku vision.
 *
 * @param photoUrl      - Publicly accessible URL of the submitted photo
 * @param missionDescription - Human-readable mission context (name + desc / prompt)
 * @param maxPts        - Maximum points available for this mission
 * @param scoringFocus  - Optional extra instructions from the organizer (games.ai_photo_instructions)
 * @returns             Points awarded, rounded to the nearest valid step
 * @throws              If the Claude API call fails or returns unparseable JSON
 */
export async function ratePhoto(params: {
  photoUrl: string;
  missionDescription: string;
  maxPts: number;
  scoringFocus?: string | null;
}): Promise<number> {
  const { photoUrl, missionDescription, maxPts, scoringFocus } = params;
  const validPts = getValidPoints(maxPts);

  const promptLines = [
    'You are judging a photo submission for a team competition.',
    '',
    `Mission: ${missionDescription}`,
    `Max points available: ${maxPts}`,
    ...(scoringFocus ? [`Extra scoring focus from the organizer: ${scoringFocus}`] : []),
    '',
    `Award a score from 0 to ${maxPts}:`,
    '- 0: Photo is completely off-topic, unrelated to the mission, or blank',
    '- ~25% of max: Attempted but barely matches what was asked',
    '- ~50% of max: Acceptable effort, partially matches the mission',
    '- ~75% of max: Good match, clearly understood the mission',
    `- 100% of max (${maxPts} points): Perfect execution, exactly what was asked`,
    '',
    'Respond with ONLY valid JSON: {"points": <integer>}',
  ];

  const response = await client.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 64,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: photoUrl },
          },
          {
            type: 'text',
            text: promptLines.join('\n'),
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
  const match = text.match(/"points"\s*:\s*(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Unexpected AI response: ${text}`);

  const raw = Math.round(parseFloat(match[1]));
  return roundToNearest(raw, validPts);
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ai-photo-rater.ts
git commit -m "feat: add Claude Haiku vision utility for photo rating"
```

---

### Task 3: PATCH game settings route + update create-game

**Files:**
- Create: `app/api/admin/game/[id]/route.ts`
- Modify: `app/api/admin/game/route.ts`

- [ ] **Step 1: Create `app/api/admin/game/[id]/route.ts`**

```typescript
// app/api/admin/game/[id]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const db = adminClient();

  const { data: game } = await db
    .from('games')
    .select('user_id')
    .eq('id', params.id)
    .single();

  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!admin.isSuperAdmin && game.user_id !== admin.userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.ai_photo_rating !== undefined) updates.ai_photo_rating = body.ai_photo_rating;
  if (body.ai_photo_instructions !== undefined) updates.ai_photo_instructions = body.ai_photo_instructions;

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  const { error } = await db.from('games').update(updates).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Update create-game in `app/api/admin/game/route.ts`**

Find the destructuring line:
```typescript
  const { name, missions, duration_minutes, mission_max_pts, hide_leaderboard } = body;
```

Replace with:
```typescript
  const { name, missions, duration_minutes, mission_max_pts, hide_leaderboard, ai_photo_rating, ai_photo_instructions } = body;
```

Find the `.insert({` call in the create-game section. Add two new fields after `hide_leaderboard`:
```typescript
      hide_leaderboard: hide_leaderboard ?? false,
      ai_photo_rating: ai_photo_rating ?? false,
      ai_photo_instructions: ai_photo_instructions ?? null,
      status: 'draft',
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/game/route.ts app/api/admin/game/[id]/route.ts
git commit -m "feat: add PATCH game settings route and ai_photo_rating to create-game"
```

---

### Task 4: Fix re-rating in admin rate endpoints

Both `/api/admin/photos/rate` and `/api/scavenger/review` currently add points on top even for already-completed missions. With AI auto-rating, re-rating must adjust the score diff and mark `ai_rated: false`.

**Files:**
- Modify: `app/api/admin/photos/rate/route.ts`
- Modify: `app/api/scavenger/review/route.ts`

- [ ] **Step 1: Rewrite `/api/admin/photos/rate/route.ts`**

Replace the entire file with:

```typescript
// app/api/admin/photos/rate/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { submissionId, teamId, missionId, points } = await req.json();

  if (!submissionId || !teamId || !missionId || points === undefined) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  // Mark submission as manually rated (clears ai_rated flag)
  const { error: subErr } = await supabase
    .from('photo_submissions')
    .update({ status: 'rated', points_awarded: points, ai_rated: false })
    .eq('id', submissionId);

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('score, completed, mission_scores')
    .eq('id', teamId)
    .single();

  if (teamErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  const mission = MISSIONS.find(m => m.id === missionId);
  const missionName = mission ? `${mission.icon} ${mission.name}` : 'Photo Challenge';

  const notification = points > 0
    ? { type: 'photo_rated', message: `Your photo for "${missionName}" has been rated! You earned ${points} points! 🎉` }
    : { type: 'photo_rated', message: `Your photo for "${missionName}" was reviewed — unfortunately no points this time. Keep going! 💪` };

  const alreadyCompleted = team.completed?.includes(missionId);

  if (!alreadyCompleted) {
    // First time rated — add points and mark completed
    const newMissionScores = { ...(team.mission_scores ?? {}), [missionId]: points };
    const { error: updateErr } = await supabase
      .from('teams')
      .update({
        score: (team.score ?? 0) + points,
        completed: [...(team.completed ?? []), missionId],
        mission_scores: newMissionScores,
        pending_notification: notification,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamId);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  } else {
    // Re-rating (e.g. overriding an AI score) — apply score diff
    const oldPoints = (team.mission_scores as Record<string, number>)?.[missionId] ?? 0;
    const scoreDiff = points - oldPoints;
    const newMissionScores = { ...(team.mission_scores ?? {}), [missionId]: points };
    const { error: updateErr } = await supabase
      .from('teams')
      .update({
        score: Math.max(0, (team.score ?? 0) + scoreDiff),
        mission_scores: newMissionScores,
        pending_notification: notification,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamId);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Rewrite `/api/scavenger/review/route.ts`**

Replace the entire file with:

```typescript
// app/api/scavenger/review/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { submissionId, teamId, missionId, itemLabel, points } = await req.json();

  if (!submissionId || !teamId || !missionId || points === undefined) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  // Fetch existing submission to determine if this is a re-rate
  const { data: existingSub } = await supabase
    .from('scavenger_submissions')
    .select('status, points_awarded')
    .eq('id', submissionId)
    .single();

  const wasAlreadyRated = existingSub?.status === 'rated';
  const oldPoints = wasAlreadyRated ? (existingSub?.points_awarded ?? 0) : 0;
  const scoreDiff = points - oldPoints;

  // Mark submission as manually rated (clears ai_rated flag)
  const { error: subErr } = await supabase
    .from('scavenger_submissions')
    .update({ status: 'rated', points_awarded: points, ai_rated: false })
    .eq('id', submissionId);

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  // No score change needed if diff is zero
  if (scoreDiff === 0) return NextResponse.json({ ok: true });

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('score, completed, pending_notification')
    .eq('id', teamId)
    .single();

  if (teamErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  const mission = MISSIONS.find(m => m.id === missionId);
  const missionName = mission ? `${mission.icon} ${mission.name}` : 'Scavenger Hunt';

  const notification = points > 0
    ? { type: 'photo_rated', message: `Your photo for "${itemLabel}" in ${missionName} was rated! You earned ${points} points! 🎉` }
    : { type: 'photo_rated', message: `Your photo for "${itemLabel}" was reviewed — unfortunately no points this time. Keep going! 💪` };

  const alreadyCompleted = team.completed?.includes(missionId);

  const { error: updateErr } = await supabase
    .from('teams')
    .update({
      score: Math.max(0, (team.score ?? 0) + scoreDiff),
      completed: alreadyCompleted
        ? team.completed
        : points > 0
          ? [...(team.completed ?? []), missionId]
          : team.completed,
      pending_notification: notification,
      updated_at: new Date().toISOString(),
    })
    .eq('id', teamId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/photos/rate/route.ts app/api/scavenger/review/route.ts
git commit -m "fix: handle re-rating score diff and clear ai_rated flag on manual override"
```

---

### Task 5: Trigger AI rating on photo submission

**Files:**
- Modify: `app/api/team/photo/route.ts`

- [ ] **Step 1: Rewrite `app/api/team/photo/route.ts`**

Replace the entire file with:

```typescript
// app/api/team/photo/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';
import { ratePhoto as aiRatePhoto } from '@/lib/ai-photo-rater';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { teamId, teamName, missionId, photoUrl } = await req.json();

  if (!teamId || !missionId || !photoUrl) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  // Insert submission — return id for potential AI update
  const { data: insertedSub, error } = await supabase
    .from('photo_submissions')
    .insert({
      team_id: teamId,
      team_name: teamName,
      mission_id: missionId,
      photo_url: photoUrl,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Respond to player immediately — AI rating happens after
  // Fire-and-forget pattern: we await inline but errors are caught and swallowed
  // so the player's submission is never blocked by AI latency.
  (async () => {
    try {
      // Get game settings via team → game
      const { data: teamRow } = await supabase
        .from('teams')
        .select('game_id')
        .eq('id', teamId)
        .single();

      if (!teamRow?.game_id) return;

      const { data: game } = await supabase
        .from('games')
        .select('ai_photo_rating, ai_photo_instructions, mission_max_pts')
        .eq('id', teamRow.game_id)
        .single();

      if (!game?.ai_photo_rating) return;

      // Resolve mission description
      const mission = MISSIONS.find(m => m.id === missionId);
      let missionDescription = mission
        ? `${mission.name}: ${mission.desc}`
        : 'Photo challenge';

      if (!mission) {
        // Try custom mission
        const { data: custom } = await supabase
          .from('custom_missions')
          .select('name, data')
          .eq('id', missionId)
          .single();
        if (custom) {
          const prompt = (custom.data as Record<string, unknown>)?.prompt as string | undefined;
          missionDescription = prompt ? `${custom.name}: ${prompt}` : (custom.name as string);
        }
      }

      const maxPts =
        (game.mission_max_pts as Record<string, number>)?.[missionId] ??
        mission?.maxPts ??
        500;

      const points = await aiRatePhoto({
        photoUrl,
        missionDescription,
        maxPts,
        scoringFocus: game.ai_photo_instructions,
      });

      // Mark submission as AI-rated
      await supabase
        .from('photo_submissions')
        .update({ status: 'rated', points_awarded: points, ai_rated: true })
        .eq('id', insertedSub.id);

      // Add points to team (same logic as /api/admin/photos/rate — first time only)
      const { data: team } = await supabase
        .from('teams')
        .select('score, completed, mission_scores')
        .eq('id', teamId)
        .single();

      if (!team) return;

      const missionName = mission ? `${mission.icon} ${mission.name}` : 'Photo Challenge';
      const notification = points > 0
        ? { type: 'photo_rated', message: `Your photo for "${missionName}" was rated by AI! You earned ${points} points! 🎉` }
        : { type: 'photo_rated', message: `Your photo for "${missionName}" was reviewed — unfortunately no points this time. Keep going! 💪` };

      if (!team.completed?.includes(missionId)) {
        const newMissionScores = { ...(team.mission_scores ?? {}), [missionId]: points };
        await supabase.from('teams').update({
          score: (team.score ?? 0) + points,
          completed: [...(team.completed ?? []), missionId],
          mission_scores: newMissionScores,
          pending_notification: notification,
          updated_at: new Date().toISOString(),
        }).eq('id', teamId);
      }
    } catch (err) {
      console.error('[ai-photo-rating] Failed to auto-rate photo:', err);
      // Submission stays as 'pending' — admin can rate manually
    }
  })();

  return NextResponse.json({ ok: true });
}
```

Note: The IIFE pattern `(async () => { ... })()` fires the AI work without blocking the response. In Next.js App Router, the runtime gives the request handler a short window after the response to complete pending microtasks — this is sufficient for the Haiku call (~500ms). If the call takes longer, the runtime may cancel it, leaving the submission as `pending` for manual rating. This is acceptable behaviour.

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/team/photo/route.ts
git commit -m "feat: trigger AI photo rating on submission when AI mode is on"
```

---

### Task 6: Trigger AI rating on scavenger photo submission

**Files:**
- Modify: `app/api/scavenger/submit/route.ts`

- [ ] **Step 1: Rewrite `app/api/scavenger/submit/route.ts`**

Replace the entire file with:

```typescript
// app/api/scavenger/submit/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';
import { ratePhoto as aiRatePhoto } from '@/lib/ai-photo-rater';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { teamId, teamName, gameId, missionId, itemId, itemLabel, photoUrl } = await req.json();

  if (!teamId || !gameId || !missionId || !itemId || !photoUrl) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('scavenger_submissions')
    .upsert(
      {
        team_id: teamId,
        team_name: teamName,
        game_id: gameId,
        mission_id: missionId,
        item_id: itemId,
        item_label: itemLabel,
        photo_url: photoUrl,
        status: 'pending',
        points_awarded: null,
        ai_rated: false,
      },
      { onConflict: 'team_id,mission_id,item_id', ignoreDuplicates: false }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attempt AI rating after responding to player
  (async () => {
    try {
      const { data: game } = await supabase
        .from('games')
        .select('ai_photo_rating, ai_photo_instructions, mission_max_pts')
        .eq('id', gameId)
        .single();

      if (!game?.ai_photo_rating) return;

      const missionDescription =
        `Scavenger Hunt — teams must photograph: ${itemLabel ?? 'the required item'}. Did they find it?`;

      const mission = MISSIONS.find(m => m.id === missionId);
      const maxPts =
        (game.mission_max_pts as Record<string, number>)?.[missionId] ??
        mission?.maxPts ??
        500;

      const points = await aiRatePhoto({
        photoUrl,
        missionDescription,
        maxPts,
        scoringFocus: game.ai_photo_instructions,
      });

      // Mark submission as AI-rated
      await supabase
        .from('scavenger_submissions')
        .update({ status: 'rated', points_awarded: points, ai_rated: true })
        .eq('team_id', teamId)
        .eq('mission_id', missionId)
        .eq('item_id', itemId);

      // Add points to team
      const { data: team } = await supabase
        .from('teams')
        .select('score, completed, pending_notification')
        .eq('id', teamId)
        .single();

      if (!team) return;

      const missionName = mission ? `${mission.icon} ${mission.name}` : 'Scavenger Hunt';
      const notification = points > 0
        ? { type: 'photo_rated', message: `Your photo for "${itemLabel}" in ${missionName} was rated by AI! You earned ${points} points! 🎉` }
        : { type: 'photo_rated', message: `Your photo for "${itemLabel}" was reviewed — unfortunately no points this time. Keep going! 💪` };

      const alreadyCompleted = team.completed?.includes(missionId);

      await supabase.from('teams').update({
        score: (team.score ?? 0) + points,
        completed: alreadyCompleted
          ? team.completed
          : points > 0
            ? [...(team.completed ?? []), missionId]
            : team.completed,
        pending_notification: notification,
        updated_at: new Date().toISOString(),
      }).eq('id', teamId);
    } catch (err) {
      console.error('[ai-photo-rating] Failed to auto-rate scavenger photo:', err);
    }
  })();

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/scavenger/submit/route.ts
git commit -m "feat: trigger AI rating on scavenger photo submission when AI mode is on"
```

---

### Task 7: AdminScreen UI

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

This task has many insertion points. Read the file before each step to find exact line numbers.

- [ ] **Step 1: Add new state variables**

Find `const [manageTemplatesLoading, setManageTemplatesLoading] = useState(false);` (the last template state added in the game-templates feature). Add directly after it:

```typescript
  // AI photo rating
  const [aiPhotoRating, setAiPhotoRating] = useState(false);
  const [aiPhotoInstructions, setAiPhotoInstructions] = useState('');
  const [aiRatingEnabled, setAiRatingEnabled] = useState(false);
  const [aiRatingInstructions, setAiRatingInstructions] = useState('');
  const [overridingPhotoId, setOverridingPhotoId] = useState<string | null>(null);
```

- [ ] **Step 2: Add useEffect to sync live toggle from activeGame**

Find the existing `useEffect` that uses `activeGameId` as a dependency (around line 543). Add a new, separate useEffect after it:

```typescript
  // Sync AI rating live-toggle state when switching to a different game
  useEffect(() => {
    if (activeGame) {
      setAiRatingEnabled(activeGame.ai_photo_rating ?? false);
      setAiRatingInstructions(activeGame.ai_photo_instructions ?? '');
    }
  }, [activeGameId]); // activeGameId = activeGame?.id, defined above
```

- [ ] **Step 3: Add `toggleAiRating` function**

Find the `loadTemplates` function. Add the following function alongside it:

```typescript
  async function toggleAiRating(enabled: boolean) {
    if (!activeGame || !authToken) return;
    setAiRatingEnabled(enabled);
    const res = await fetch(`/api/admin/game/${activeGame.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        ai_photo_rating: enabled,
        ai_photo_instructions: aiRatingInstructions,
      }),
    });
    if (!res.ok) {
      setAiRatingEnabled(!enabled); // revert on failure
      showToast('Failed to update AI rating setting', 'error');
    }
  }
```

- [ ] **Step 4: Add AI toggle to create-game form**

Find the hide-leaderboard toggle div (search for `🙈 Hide leaderboard`). It is inside a `<div className="form-group" style={{ marginBottom: 0 }}>`. Add the AI rating toggle block directly after the closing `</div>` of that form-group:

```tsx
          <div className="form-group" style={{ marginBottom: 0, marginTop: '10px' }}>
            <div
              onClick={() => setAiPhotoRating(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '12px 14px', background: 'var(--surface)', border: `1px solid ${aiPhotoRating ? 'var(--accent)' : 'var(--border)'}`, borderRadius: aiPhotoRating ? '10px 10px 0 0' : '10px' }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>✨ AI photo rating</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
                  Photos rated automatically by AI — you can override anytime
                </div>
              </div>
              <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: aiPhotoRating ? 'var(--accent)' : 'var(--border)', position: 'relative', flexShrink: 0, marginLeft: '12px' }}>
                <div style={{ position: 'absolute', top: '2px', left: aiPhotoRating ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </div>
            </div>
            {aiPhotoRating && (
              <div style={{ padding: '12px 14px', background: 'var(--surface)', border: `1px solid var(--accent)`, borderTop: 'none', borderRadius: '0 0 10px 10px' }} onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Scoring focus <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </div>
                <input
                  type="text"
                  value={aiPhotoInstructions}
                  onChange={e => setAiPhotoInstructions(e.target.value)}
                  placeholder="e.g. Reward creativity and humor extra highly"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '12px', fontFamily: "'Sora', sans-serif", boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '5px' }}>
                  Passed to the AI as extra context when rating photos
                </div>
              </div>
            )}
          </div>
```

- [ ] **Step 5: Update `createGame()` to send AI fields**

Find the `body: JSON.stringify({...})` in the `createGame` function. Add the two new fields:

```typescript
      body: JSON.stringify({
        name: gameName,
        missions: selectedMissions,
        duration_minutes: duration,
        mission_max_pts: customPts,
        hide_leaderboard: hideLeaderboard,
        ai_photo_rating: aiPhotoRating,
        ai_photo_instructions: aiPhotoInstructions || null,
      }),
```

- [ ] **Step 6: Add AI toggle + info card to Photos tab**

Find the Photos tab opening (search for `{tab === 'photos' && (`). Inside the `<div className="fade-in">`, find the `<div className="section-header">` that contains `"Photo Submissions"`. Replace that entire `section-header` div with:

```tsx
            <div className="section-header">
              <div>
                <h2 style={{ fontSize: '18px', margin: 0 }}>Photo Submissions</h2>
                <span className="badge" style={{ marginTop: '4px' }}>{pendingPhotos.length} pending</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>AI rating</span>
                <div
                  onClick={() => toggleAiRating(!aiRatingEnabled)}
                  style={{ width: '36px', height: '20px', borderRadius: '10px', background: aiRatingEnabled ? 'var(--accent)' : 'var(--border)', position: 'relative', cursor: 'pointer', flexShrink: 0 }}
                >
                  <div style={{ position: 'absolute', top: '2px', left: aiRatingEnabled ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: aiRatingEnabled ? 'var(--accent)' : 'var(--muted)' }}>
                  {aiRatingEnabled ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>

            {/* AI info card */}
            {aiRatingEnabled && (
              <div style={{ background: 'rgba(124,189,212,0.06)', border: '1px solid rgba(124,189,212,0.2)', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <span>✨</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>AI rating is on</span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Photos are rated automatically when submitted</div>
                {aiRatingInstructions && (
                  <div style={{ marginTop: '8px', background: 'var(--surface)', borderRadius: '6px', padding: '6px 10px', fontSize: '11px' }}>
                    <span style={{ color: 'var(--muted)', marginRight: '4px' }}>Focus:</span>
                    <span style={{ fontStyle: 'italic', color: 'var(--text)' }}>{aiRatingInstructions}</span>
                  </div>
                )}
              </div>
            )}
```

- [ ] **Step 7: Add AI badge + override button to rated regular photos**

In the rated photos section, find the regular photo card (search for `sub._type === 'regular'`). Inside that card's header div, find:

```tsx
                            <span style={{ color: 'var(--accent3)', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>✓ {(sub as typeof ratedRegular[0]).points_awarded ?? 0}p</span>
```

Replace with:

```tsx
                            <span style={{
                              background: (sub as typeof ratedRegular[0]).ai_rated ? 'rgba(124,189,212,0.15)' : 'transparent',
                              borderRadius: '4px',
                              padding: (sub as typeof ratedRegular[0]).ai_rated ? '2px 5px' : '0',
                              color: (sub as typeof ratedRegular[0]).ai_rated ? 'var(--accent)' : 'var(--accent3)',
                              fontWeight: 700, fontSize: '11px', flexShrink: 0,
                            }}>
                              {(sub as typeof ratedRegular[0]).ai_rated ? '✨' : '✓'} {(sub as typeof ratedRegular[0]).points_awarded ?? 0}p
                            </span>
```

Then, after the `<div style={{ height: '140px', ... }}>` image div, add an override footer. Find the closing `</div>` of the regular photo card (the one that wraps the header + image) and insert before it:

```tsx
                          {overridingPhotoId === sub.id ? (
                            <div style={{ padding: '6px 8px', display: 'flex', gap: '4px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                              {getPointOptions(activeGame.mission_max_pts?.[(sub as typeof ratedRegular[0]).mission_id] ?? MISSIONS.find(m => m.id === (sub as typeof ratedRegular[0]).mission_id)?.maxPts ?? 500).map(pts => (
                                <button key={pts} onClick={() => { ratePhoto(sub as PhotoSubmission, pts); setOverridingPhotoId(null); }}
                                  style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: pts === ((sub as typeof ratedRegular[0]).points_awarded ?? 0) ? 'var(--accent)' : 'var(--surface)', color: pts === ((sub as typeof ratedRegular[0]).points_awarded ?? 0) ? '#0a0e19' : 'var(--text)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '11px' }}>
                                  {pts}p
                                </button>
                              ))}
                              <button onClick={() => setOverridingPhotoId(null)} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                            </div>
                          ) : (
                            <button onClick={() => setOverridingPhotoId(sub.id)} style={{ width: '100%', padding: '5px', borderTop: '1px solid var(--border)', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '10px', fontFamily: "'Sora', sans-serif" }}>
                              {(sub as typeof ratedRegular[0]).ai_rated ? 'Override ✨' : '✏️ Change'}
                            </button>
                          )}
```

- [ ] **Step 8: Add AI badge + override button to rated scavenger photos**

In the same rated section, find the scavenger card (the `else` branch, searching for `s.item_label`). Find the score badge:

```tsx
                            <span style={{ color: 'var(--accent3)', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>✓ {s.points_awarded ?? 0}p</span>
```

Replace with:

```tsx
                            <span style={{
                              background: s.ai_rated ? 'rgba(124,189,212,0.15)' : 'transparent',
                              borderRadius: '4px',
                              padding: s.ai_rated ? '2px 5px' : '0',
                              color: s.ai_rated ? 'var(--accent)' : 'var(--accent3)',
                              fontWeight: 700, fontSize: '11px', flexShrink: 0,
                            }}>
                              {s.ai_rated ? '✨' : '✓'} {s.points_awarded ?? 0}p
                            </span>
```

After the image div in the scavenger card, add the override footer (before the closing `</div>` of the scavenger card):

```tsx
                          {overridingPhotoId === sub.id ? (
                            <div style={{ padding: '6px 8px', display: 'flex', gap: '4px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                              {[0, 25, 50, 75, 100].map(pts => (
                                <button key={pts} onClick={() => { rateScavengerPhoto(sub as ScavengerSubmission, pts); setOverridingPhotoId(null); }}
                                  style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: pts === (s.points_awarded ?? 0) ? 'var(--accent)' : 'var(--surface)', color: pts === (s.points_awarded ?? 0) ? '#0a0e19' : 'var(--text)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '11px' }}>
                                  {pts}p
                                </button>
                              ))}
                              <button onClick={() => setOverridingPhotoId(null)} style={{ padding: '4px 8px', borderRadius: '5px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                            </div>
                          ) : (
                            <button onClick={() => setOverridingPhotoId(sub.id)} style={{ width: '100%', padding: '5px', borderTop: '1px solid var(--border)', background: 'transparent', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer', fontSize: '10px', fontFamily: "'Sora', sans-serif" }}>
                              {s.ai_rated ? 'Override ✨' : '✏️ Change'}
                            </button>
                          )}
```

- [ ] **Step 9: Reset `aiPhotoRating` and `aiPhotoInstructions` when navigating to create view**

Find where `setView('create')` is called from the template library (when user picks a blank game or template). Also find the "+ NEW GAME" button handler. In both cases, reset the create-game AI state:

Search for `setView('create')` calls in the create flow. Where `setSelectedMissions` is also called (template or blank game), add:
```typescript
setAiPhotoRating(false);
setAiPhotoInstructions('');
```

These resets ensure the toggle starts off for every new game.

- [ ] **Step 10: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: no errors. Fix any TypeScript errors (common: cast `sub` properly when calling `ratePhoto`/`rateScavengerPhoto` — use `sub as PhotoSubmission` or `sub as ScavengerSubmission`).

- [ ] **Step 11: Build check**

```bash
cd /Users/signevallin/Desktop/GameOn && npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 12: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add AI photo rating UI — create-game toggle, Photos tab live toggle, badges, override"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `games.ai_photo_rating`, `games.ai_photo_instructions`, `photo_submissions.ai_rated` | Task 1 |
| `scavenger_submissions.ai_rated` | Task 1 |
| `Game` type updated | Task 1 |
| `lib/ai-photo-rater.ts` — Claude Haiku vision utility | Task 2 |
| Scoring focus injected into prompt | Task 2 |
| Rounding to nearest valid point step | Task 2 |
| Error: submission stays pending on AI failure | Task 2 (try/catch in callers) |
| `PATCH /api/admin/game/[id]` live settings update | Task 3 |
| Create-game POST accepts `ai_photo_rating` + `ai_photo_instructions` | Task 3 |
| Re-rating applies score diff (not additive) | Task 4 |
| Manual override clears `ai_rated` flag | Task 4 |
| Photo submission triggers AI when mode on | Task 5 |
| Scavenger submission triggers AI when mode on | Task 6 |
| Create-game toggle + scoring focus input | Task 7 |
| Live toggle in Photos tab header | Task 7 |
| AI info card with scoring focus shown | Task 7 |
| `✨ AI` vs `✏️` badge on rated photos | Task 7 |
| Override / Change button on all rated photos | Task 7 |
| Live toggle updates DB via PATCH | Task 7 |
| AI state reset when starting a new game | Task 7 |

**Placeholder scan:** None found.

**Type consistency:** `ratePhoto` (the AI utility in `lib/ai-photo-rater.ts`) is imported as `aiRatePhoto` in both submission routes to avoid name collision with the admin `ratePhoto` function in AdminScreen. `PhotoSubmission` and `ScavengerSubmission` both gain `ai_rated?: boolean`. `Game` type gains `ai_photo_rating?: boolean` and `ai_photo_instructions?: string | null`. All usages in Task 7 reference these correctly.
