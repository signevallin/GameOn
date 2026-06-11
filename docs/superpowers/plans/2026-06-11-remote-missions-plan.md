# Remote Missions (Relay + Shared Secret) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new mission types for remote mode — `relay` (sequential typing/trivia challenges per team member) and `shared_secret` (distributed clues requiring verbal coordination) — with four built-in examples and full admin customisation support.

**Architecture:** Extend the existing `MissionType` union and `Mission` shape in `lib/missions.ts`; add a new `'remote'` super-category; create game components `RelayMission.tsx` and `SharedSecret.tsx` that manage their own Realtime subscriptions on the already-open `remote-nav-{teamId}` channel; add a relay advance/skip API route; wire everything into `ChallengeScreen`, `AdminScreen`, and `lib/custom-missions.ts`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (PostgreSQL + Realtime Broadcast), React hooks, existing i18n (react-i18next), existing scoring via `calcPoints`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260611_remote_missions.sql` | Create | Add `relay_state JSONB` column to `teams` |
| `lib/missions.ts` | Modify | Add `MissionType` values; add `segments`, `relayMode`, and per-mission fields; add 4 built-in missions |
| `lib/superCategories.ts` | Modify | Add `'remote'` key to `SuperCategoryKey` + `SUPER_CATEGORIES` + 4 `MISSION_SUPER_CATEGORY` entries |
| `app/api/team/relay/route.ts` | Create | POST endpoint: advance/skip relay segment; update `relay_state` in DB |
| `components/games/RelayMission.tsx` | Create | Relay UI — active prompt, queue view, progress bar, Realtime sync |
| `components/games/SharedSecret.tsx` | Create | Shared secret UI — personal clue, guess input, attempt counter, hint reveal, Realtime sync |
| `components/screens/ChallengeScreen.tsx` | Modify | Add `memberId?: string` prop; add `case 'relay'` and `case 'shared_secret'` in `renderGame()` |
| `app/play/page.tsx` | Modify | Pass `memberId` prop down to `ChallengeScreen` |
| `components/screens/AdminScreen.tsx` | Modify | Add `relay`/`shared_secret` type options; add dynamic segment/clue fields to custom mission form |
| `lib/custom-missions.ts` | Modify | Add `relay` and `shared_secret` cases to `toMission`, `validateMissionData`, `buildMissionData` |

---

## Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260611_remote_missions.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260611_remote_missions.sql
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS relay_state JSONB;
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Run `apply_migration` with the SQL above. Verify no error is returned.

- [ ] **Step 3: Verify column exists**

Run `execute_sql`: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'teams' AND column_name = 'relay_state';`

Expected: one row with `data_type = 'jsonb'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260611_remote_missions.sql
git commit -m "feat: add relay_state JSONB column to teams"
```

---

## Task 2: Type System — MissionType, Mission shape, SuperCategories, Built-in Missions

**Files:**
- Modify: `lib/missions.ts`
- Modify: `lib/superCategories.ts`

### Part A: lib/missions.ts

- [ ] **Step 1: Add `'relay'` and `'shared_secret'` to MissionType**

In `lib/missions.ts`, change the `MissionType` export (currently ends at `'text_quiz'`):

```ts
export type MissionType =
  | 'multiple_choice'
  | 'text_input'
  | 'puzzle'
  | 'memory'
  | 'reaction'
  | 'typerace'
  | 'hangman'
  | 'wouldyou'
  | 'truefalse'
  | 'photo'
  | 'pa_sparet'
  | 'solve_crime'
  | 'celebrity_quiz'
  | 'music_emoji'
  | 'crack_code'
  | 'music_quiz'
  | 'image_quiz'
  | 'memory_speed'
  | 'color_memory'
  | 'pixel_reveal'
  | 'zoom_in'
  | 'simon_says'
  | 'timeline'
  | 'closest_wins'
  | 'duel_trivia'
  | 'scavenger_hunt'
  | 'trivia_quiz'
  | 'movie_emoji'
  | 'text_quiz'
  | 'relay'
  | 'shared_secret';
```

- [ ] **Step 2: Add new fields to Mission type**

Add two new optional fields after `hexColour` in the `Mission` type:

```ts
export type Mission = {
  // ... all existing fields unchanged ...
  hexColour?: string;
  // ── Remote mission fields ──────────────────────────────────────────────────
  /** relay: one segment per team member */
  segments?: { prompt: string }[];
  /** relay: 'typerace' = member must type the prompt exactly; 'button' = honor-system Done button */
  relayMode?: 'typerace' | 'button';
};
```

(SharedSecret reuses the existing `clues?: string[]`, `answer?: string`, and `hint?: string` fields.)

- [ ] **Step 3: Add 4 built-in remote missions to the MISSIONS array**

Find the end of the `MISSIONS` array in `lib/missions.ts` and append:

```ts
  // ── REMOTE ──────────────────────────────────────────────────────────────────
  {
    id: 'relay_typerace',
    icon: '⌨️',
    name: 'Ordstafett',
    category: 'remote',
    desc: 'Varje person skriver sin pangram så snabbt som möjligt — stafett!',
    difficulty: 'medium' as Difficulty,
    maxPts: 500,
    type: 'relay' as MissionType,
    relayMode: 'typerace',
    segments: [
      { prompt: 'The quick brown fox jumps over the lazy dog' },
      { prompt: 'Pack my box with five dozen liquor jugs' },
      { prompt: 'How vexingly quick daft zebras jump' },
      { prompt: 'Sphinx of black quartz, judge my vow' },
    ],
  },
  {
    id: 'relay_trivia',
    icon: '🧠',
    name: 'Faktastafett',
    category: 'remote',
    desc: 'Varje person svarar på en triviafråga — sedan är nästa i tur!',
    difficulty: 'medium' as Difficulty,
    maxPts: 500,
    type: 'relay' as MissionType,
    relayMode: 'button',
    segments: [
      { prompt: 'Vad är Australiens huvudstad? (Svar: Canberra)' },
      { prompt: 'Hur många ben har en vuxen människa? (Svar: 206)' },
      { prompt: 'Vilket år föll Berlinmuren? (Svar: 1989)' },
      { prompt: 'Vad är det kemiska tecknet för guld? (Svar: Au)' },
    ],
  },
  {
    id: 'secret_word',
    icon: '🔍',
    name: 'Hemligt ord',
    category: 'remote',
    desc: 'Var och en har en ledtråd — diskutera på videosamtalet och gissa ordet!',
    difficulty: 'easy' as Difficulty,
    maxPts: 400,
    type: 'shared_secret' as MissionType,
    clues: ['Det är vitt', 'Det finns i varje kök', 'Det används för att bevara mat', 'Det smakar salt'],
    answer: 'salt',
    hint: 'Tänk matlagning',
  },
  {
    id: 'secret_code',
    icon: '🔐',
    name: 'Den försvunna koden',
    category: 'remote',
    desc: 'Varje person har en siffra i PIN-koden — rekonstruera den tillsammans!',
    difficulty: 'easy' as Difficulty,
    maxPts: 300,
    type: 'shared_secret' as MissionType,
    clues: ['Den första siffran är 3', 'Den andra siffran är 7', 'Den tredje siffran är 1', 'Den fjärde siffran är 9'],
    answer: '3719',
    hint: 'Kombinera alla siffror i rätt ordning',
  },
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `lib/missions.ts`.

### Part B: lib/superCategories.ts

- [ ] **Step 5: Add `'remote'` to SuperCategoryKey and SUPER_CATEGORIES**

```ts
export type SuperCategoryKey = 'tech' | 'logic' | 'music_film' | 'knowledge' | 'action' | 'gkn' | 'remote';

export const SUPER_CATEGORIES: Record<SuperCategoryKey, {
  label: string;
  icon: string;
  color: string;
  desc: string;
}> = {
  tech:       { label: 'Tech & IT',            icon: '💻', color: 'var(--accent)',  desc: 'Coding, ciphers, logos and tech icons' },
  logic:      { label: 'Logic & Mind',          icon: '🧠', color: '#b084cc',        desc: 'Puzzles, patterns and brain teasers' },
  music_film: { label: 'Music & Film',          icon: '🎵', color: 'var(--gold)',    desc: 'Songs, lyrics and movie knowledge' },
  knowledge:  { label: 'Knowledge & Trivia',    icon: '🌍', color: 'var(--accent3)', desc: 'Geography, history and general trivia' },
  action:     { label: 'Action & Creative',     icon: '⚡', color: 'var(--accent2)', desc: 'Physical, speed and creative challenges' },
  gkn:        { label: 'GKN Aerospace',          icon: '✈️', color: '#4a90d9',        desc: 'Missions about GKN Aerospace and aviation' },
  remote:     { label: 'Remote Teamwork',        icon: '🌐', color: '#6366f1',        desc: 'Challenges designed for remote teams on a video call' },
};
```

- [ ] **Step 6: Add 4 entries to MISSION_SUPER_CATEGORY**

At the end of `MISSION_SUPER_CATEGORY` (after `gkn_aircraft_quiz`):

```ts
  // Remote Teamwork
  relay_typerace: 'remote',
  relay_trivia:   'remote',
  secret_word:    'remote',
  secret_code:    'remote',
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add lib/missions.ts lib/superCategories.ts
git commit -m "feat: add relay + shared_secret mission types, 4 built-in remote missions, REMOTE super-category"
```

---

## Task 3: Relay API Route

**Files:**
- Create: `app/api/team/relay/route.ts`

The relay API stores per-mission state in `teams.relay_state` (a JSONB map keyed by `missionId`). The client broadcasts `relay-advance` after a successful call.

- [ ] **Step 1: Write the route**

```ts
// app/api/team/relay/route.ts
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
  let body: { teamId?: unknown; missionId?: unknown; action?: unknown; elapsedMs?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { teamId, missionId, action, elapsedMs } = body;

  if (!teamId || typeof teamId !== 'string') {
    return NextResponse.json({ error: 'Missing teamId.' }, { status: 400 });
  }
  if (!missionId || typeof missionId !== 'string') {
    return NextResponse.json({ error: 'Missing missionId.' }, { status: 400 });
  }
  if (action !== 'advance' && action !== 'skip') {
    return NextResponse.json({ error: 'action must be "advance" or "skip".' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Fetch current team to read relay_state
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('id, relay_state')
    .eq('id', teamId)
    .single();

  if (teamErr || !team) {
    return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const existing = (team.relay_state as Record<string, unknown> | null) ?? {};
  const missionState = (existing[missionId] as {
    activeIndex: number;
    startedAt: string;
    segments: { completedAt?: string; elapsedMs?: number; skipped?: boolean }[];
  } | undefined) ?? {
    activeIndex: 0,
    startedAt: now,
    segments: [],
  };

  const segmentRecord =
    action === 'advance'
      ? { completedAt: now, elapsedMs: typeof elapsedMs === 'number' ? elapsedMs : 0 }
      : { skipped: true, completedAt: now, elapsedMs: 0 };

  const newSegments = [...missionState.segments, segmentRecord];
  const newActiveIndex = missionState.activeIndex + 1;

  const newMissionState = {
    ...missionState,
    activeIndex: newActiveIndex,
    segments: newSegments,
  };

  const newRelayState = { ...existing, [missionId]: newMissionState };

  const { error: updateErr } = await supabase
    .from('teams')
    .update({ relay_state: newRelayState })
    .eq('id', teamId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Determine if complete — caller passes segmentCount to avoid importing MISSIONS on server
  const segmentCount =
    typeof body === 'object' && 'segmentCount' in (body as object)
      ? (body as { segmentCount?: number }).segmentCount
      : undefined;

  const complete =
    typeof segmentCount === 'number' ? newActiveIndex >= segmentCount : false;

  return NextResponse.json({ relayState: newMissionState, complete });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `app/api/team/relay/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/team/relay/route.ts
git commit -m "feat: add POST /api/team/relay for relay advance/skip"
```

---

## Task 4: RelayMission Component

**Files:**
- Create: `components/games/RelayMission.tsx`

Props pattern:
```ts
type Props = {
  mission: Mission;           // has segments, relayMode
  team: { id: string };
  game: { duration_minutes: number };
  memberId: string;           // to determine this member's index in join order
  onFinish: (correct: boolean, pts: number) => void;
}
```

The component:
1. Fetches `team_members` ordered by `created_at` to determine member indices and names.
2. Subscribes to `remote-nav-{teamId}` for `relay-advance` events to stay in sync with all members.
3. Active member sees their prompt and a Start/Done (or TypeRace) interaction.
4. Waiting members see a queue showing who's done and who's next.
5. A 60-second countdown shows time remaining for the active member; when it expires, the component auto-skips.
6. When `complete: true` returned by the API, computes score and calls `onFinish`.

- [ ] **Step 1: Create the component file**

```tsx
// components/games/RelayMission.tsx
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Mission, calcPoints } from '@/lib/missions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type RelaySegmentResult = {
  completedAt?: string;
  elapsedMs?: number;
  skipped?: boolean;
};

type RelayMissionState = {
  activeIndex: number;
  startedAt: string;
  segments: RelaySegmentResult[];
};

type Member = { id: string; name: string };

type Props = {
  mission: Mission;
  team: { id: string };
  game: { duration_minutes: number };
  memberId: string;
  effectiveMaxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

export default function RelayMission({ mission, team, game, memberId, effectiveMaxPts, onFinish }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [relayState, setRelayState] = useState<RelayMissionState | null>(null);
  const [typed, setTyped] = useState('');
  const [started, setStarted] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const segmentStartRef = useRef<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const segments = mission.segments ?? [];
  const memberIndex = members.findIndex(m => m.id === memberId);
  const effectiveIndex = memberIndex < 0 ? 0 : memberIndex;

  // Determine which segment this member is responsible for
  const mySegmentIndex = Math.min(effectiveIndex, segments.length - 1);
  const mySegment = segments[mySegmentIndex];

  const active = relayState ? relayState.activeIndex : 0;
  const isMyTurn = active === mySegmentIndex || (mySegmentIndex === segments.length - 1 && active >= segments.length - 1);
  const isWaiting = active < mySegmentIndex;
  const isPast = active > mySegmentIndex;

  // Fetch team members ordered by join time
  useEffect(() => {
    supabase
      .from('team_members')
      .select('id, name')
      .eq('team_id', team.id)
      .order('created_at')
      .then(({ data }) => {
        if (data) setMembers(data as Member[]);
      });
  }, [team.id]);

  // Subscribe to relay-advance events on the shared channel
  useEffect(() => {
    const channel = supabase
      .channel(`remote-nav-${team.id}`)
      .on('broadcast', { event: 'relay-advance' }, ({ payload }: { payload: { missionId: string; relayState: RelayMissionState } }) => {
        if (payload.missionId !== mission.id) return;
        setRelayState(payload.relayState);
        setTyped('');
        setStarted(false);
        clearCountdown();
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [team.id, mission.id]);

  function clearCountdown() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setCountdown(60);
  }

  function startCountdown() {
    clearCountdown();
    setCountdown(60);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          handleAutoSkip();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function handleStart() {
    setStarted(true);
    segmentStartRef.current = Date.now();
    startCountdown();
    if (mission.relayMode === 'typerace') {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const advance = useCallback(async (isSkip = false) => {
    if (loading) return;
    setLoading(true);
    clearCountdown();

    const elapsedMs = started ? Date.now() - segmentStartRef.current : 0;
    const currentActiveIndex = relayState?.activeIndex ?? 0;

    try {
      const res = await fetch('/api/team/relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: team.id,
          missionId: mission.id,
          action: isSkip ? 'skip' : 'advance',
          elapsedMs,
          segmentCount: segments.length,
        }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) { setLoading(false); return; }

      const newRelayState: RelayMissionState = data.relayState;
      setRelayState(newRelayState);
      setTyped('');
      setStarted(false);

      // Broadcast to all other members
      channelRef.current?.send({
        type: 'broadcast',
        event: 'relay-advance',
        payload: { missionId: mission.id, relayState: newRelayState },
      });

      if (data.complete) {
        // Compute total elapsed from startedAt → last completedAt
        const startMs = new Date(newRelayState.startedAt).getTime();
        const completedSegs = newRelayState.segments.filter(s => s.completedAt);
        const lastMs = completedSegs.length > 0
          ? new Date(completedSegs[completedSegs.length - 1].completedAt!).getTime()
          : Date.now();
        const totalElapsedSeconds = (lastMs - startMs) / 1000;
        const decayPerSecond = effectiveMaxPts / (game.duration_minutes * 60);
        const pts = Math.max(0, effectiveMaxPts - Math.floor(totalElapsedSeconds * decayPerSecond));
        onFinish(true, pts);
      }
    } catch {
      setLoading(false);
    }
  }, [loading, relayState, started, team.id, mission.id, segments.length, effectiveMaxPts, game.duration_minutes, onFinish]);

  function handleAutoSkip() {
    advance(true);
  }

  function handleTyped(val: string) {
    setTyped(val);
    if (val === mySegment?.prompt) {
      advance(false);
    }
  }

  if (members.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Laddar stafetten…</div>;
  }

  const completedCount = relayState?.segments.length ?? 0;
  const pct = Math.round((completedCount / segments.length) * 100);

  return (
    <div>
      {/* Progress bar */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
          <span>Stafetten</span>
          <span>{completedCount}/{segments.length} klara</span>
        </div>
        <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Queue view */}
      <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {members.map((m, i) => {
          const segIdx = Math.min(i, segments.length - 1);
          const isDone = (relayState?.segments[segIdx]) != null && i < active;
          const isActive = active === segIdx && i === active;
          const isNext = !isActive && !isDone;
          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px',
              borderRadius: '8px',
              border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
              background: isActive ? 'rgba(99,102,241,0.08)' : 'var(--card)',
              opacity: isNext ? 0.5 : 1,
            }}>
              <span style={{ fontSize: '18px' }}>{isDone ? '✅' : isActive ? '▶️' : '⏳'}</span>
              <span style={{ fontWeight: isActive ? 700 : 400 }}>{m.name}{m.id === memberId ? ' (du)' : ''}</span>
              {isActive && started && (
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: countdown <= 10 ? 'var(--accent2)' : 'var(--muted)' }}>
                  {countdown}s
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Active member interaction */}
      {isMyTurn && !isPast && (
        <div>
          <div className="challenge-question" style={{ marginBottom: '16px' }}>
            {mySegment?.prompt}
          </div>

          {!started ? (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleStart}>
              {loading ? 'Laddar…' : 'Starta min del ▶'}
            </button>
          ) : mission.relayMode === 'typerace' ? (
            <>
              <div style={{
                fontSize: '18px', lineHeight: '1.8', fontFamily: "'Sora', sans-serif",
                letterSpacing: '1px', marginBottom: '16px', background: '#0d1422',
                padding: '16px', borderRadius: '8px', border: '1px solid var(--border)',
              }}>
                {(mySegment?.prompt ?? '').split('').map((ch, i) => {
                  let color = 'var(--muted)';
                  let bg = 'transparent';
                  let textDecoration = 'none';
                  if (i < typed.length) {
                    color = typed[i] === ch ? 'var(--accent3)' : 'var(--accent2)';
                    textDecoration = typed[i] !== ch ? 'underline' : 'none';
                  } else if (i === typed.length) {
                    bg = 'var(--accent)';
                    color = '#0a0e19';
                  }
                  return (
                    <span key={i} style={{ color, background: bg, borderRadius: '2px', textDecoration }}>
                      {ch}
                    </span>
                  );
                })}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={typed}
                placeholder="Börja skriva här…"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onChange={e => handleTyped(e.target.value)}
              />
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                {Math.round(((typed.length) / (mySegment?.prompt.length ?? 1)) * 100)}% klar
              </p>
            </>
          ) : (
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => advance(false)}
              disabled={loading}
            >
              {loading ? 'Sparar…' : 'Jag är klar ✓'}
            </button>
          )}
        </div>
      )}

      {isWaiting && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
          <p>Väntar på {members[active]?.name ?? '…'}…</p>
        </div>
      )}

      {isPast && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--accent3)' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✅</div>
          <p>Du har gjort din del! Väntar på de andra…</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `components/games/RelayMission.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/games/RelayMission.tsx
git commit -m "feat: add RelayMission game component with Realtime sync and auto-skip"
```

---

## Task 5: SharedSecret Component

**Files:**
- Create: `components/games/SharedSecret.tsx`

Props:
```ts
type Props = {
  mission: Mission;           // has clues, answer, hint
  team: { id: string };
  game: { duration_minutes: number };
  memberId: string;
  effectiveMaxPts: number;
  startedAtMs: number;        // Date.now() when ChallengeScreen mounted
  onFinish: (correct: boolean, pts: number) => void;
};
```

The component:
1. Shows this member's personal clue (clue at `memberIndex`, clamped to last if fewer clues).
2. Provides a shared text input for the team's guess.
3. Answer check is client-side (case-insensitive trim match) — same pattern as existing `pa_sparet`.
4. Wrong guess: increments local attempt count, broadcasts `secret-attempt { missionId, attempts, correct: false }`.
5. Correct guess: broadcasts `secret-attempt { missionId, attempts, correct: true }`, then calls `onFinish`.
6. Hint revealed after 2 wrong attempts at cost of -50 pts.
7. Other members' `secret-attempt` broadcasts update the shared attempt counter.

- [ ] **Step 1: Create the component file**

```tsx
// components/games/SharedSecret.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Mission } from '@/lib/missions';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const HINT_COST = 50;
const HINT_UNLOCK_AFTER = 2;

type Props = {
  mission: Mission;
  team: { id: string };
  game: { duration_minutes: number };
  memberId: string;
  effectiveMaxPts: number;
  startedAtMs: number;
  onFinish: (correct: boolean, pts: number) => void;
};

export default function SharedSecret({ mission, team, game, memberId, effectiveMaxPts, startedAtMs, onFinish }: Props) {
  const [members, setMembers] = useState<{ id: string }[]>([]);
  const [guess, setGuess] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [lastResult, setLastResult] = useState<'correct' | 'wrong' | null>(null);
  const [done, setDone] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const clues = mission.clues ?? [];
  const answer = mission.answer ?? '';
  const hint = mission.hint ?? null;

  // Determine this member's clue index
  const memberIndex = members.findIndex(m => m.id === memberId);
  const clueIndex = memberIndex < 0 ? 0 : Math.min(memberIndex, clues.length - 1);
  const myClue = clues[clueIndex] ?? clues[0] ?? '';

  useEffect(() => {
    supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team.id)
      .order('created_at')
      .then(({ data }) => {
        if (data) setMembers(data as { id: string }[]);
      });
  }, [team.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`remote-nav-${team.id}`)
      .on('broadcast', { event: 'secret-attempt' }, ({ payload }: {
        payload: { missionId: string; attempts: number; correct: boolean }
      }) => {
        if (payload.missionId !== mission.id) return;
        setAttempts(payload.attempts);
        if (payload.correct) {
          setLastResult('correct');
          setDone(true);
          const elapsedSeconds = (Date.now() - startedAtMs) / 1000;
          const decayPerSecond = effectiveMaxPts / (game.duration_minutes * 60);
          const hintPenalty = hintUsed ? HINT_COST : 0;
          const attemptPenalty = 100 * (payload.attempts - 1);
          const pts = Math.max(0, effectiveMaxPts - Math.floor(elapsedSeconds * decayPerSecond) - attemptPenalty - hintPenalty);
          onFinish(true, pts);
        } else {
          setLastResult('wrong');
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [team.id, mission.id, startedAtMs, effectiveMaxPts, game.duration_minutes, hintUsed, onFinish]);

  function handleSubmit() {
    if (!guess.trim() || done) return;
    const correct = guess.trim().toLowerCase() === answer.toLowerCase();
    const newAttempts = attempts + 1;

    setLastResult(correct ? 'correct' : 'wrong');
    setAttempts(newAttempts);
    setGuess('');

    channelRef.current?.send({
      type: 'broadcast',
      event: 'secret-attempt',
      payload: { missionId: mission.id, attempts: newAttempts, correct },
    });

    if (correct) {
      setDone(true);
      const elapsedSeconds = (Date.now() - startedAtMs) / 1000;
      const decayPerSecond = effectiveMaxPts / (game.duration_minutes * 60);
      const hintPenalty = hintUsed ? HINT_COST : 0;
      const attemptPenalty = 100 * (newAttempts - 1);
      const pts = Math.max(0, effectiveMaxPts - Math.floor(elapsedSeconds * decayPerSecond) - attemptPenalty - hintPenalty);
      onFinish(true, pts);
    }
  }

  function handleRevealHint() {
    setShowHint(true);
    setHintUsed(true);
  }

  return (
    <div>
      {/* Personal clue */}
      <div style={{ marginBottom: '24px', padding: '20px', background: '#0d1422', borderRadius: '12px', border: '1px solid var(--accent)', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>Din ledtråd</p>
        <p style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent3)' }}>{myClue}</p>
      </div>

      <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '24px', textAlign: 'center' }}>
        Prata med ditt team på videosamtalet och gissa det hemliga ordet tillsammans!
      </p>

      {/* Attempt counter */}
      {attempts > 0 && (
        <div style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
          Felaktiga försök: {attempts} {attempts > 0 && <span style={{ color: 'var(--accent2)' }}>(-{100 * attempts} poäng)</span>}
        </div>
      )}

      {/* Feedback */}
      {lastResult === 'wrong' && (
        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--accent2)', borderRadius: '8px', textAlign: 'center', color: 'var(--accent2)' }}>
          ❌ Fel svar — försök igen!
        </div>
      )}

      {lastResult === 'correct' && (
        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(34,197,94,0.1)', border: '1px solid var(--accent3)', borderRadius: '8px', textAlign: 'center', color: 'var(--accent3)' }}>
          ✅ Rätt svar!
        </div>
      )}

      {/* Guess input */}
      {!done && (
        <>
          <input
            type="text"
            value={guess}
            placeholder="Skriv ert svar här…"
            onChange={e => setGuess(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            autoComplete="off"
          />
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px' }}
            onClick={handleSubmit}
            disabled={!guess.trim()}
          >
            Skicka svar
          </button>
        </>
      )}

      {/* Hint */}
      {hint && !showHint && attempts >= HINT_UNLOCK_AFTER && !done && (
        <button
          className="btn"
          style={{ width: '100%', marginTop: '12px', opacity: 0.8 }}
          onClick={handleRevealHint}
        >
          💡 Visa ledtråd (-{HINT_COST} poäng)
        </button>
      )}

      {hint && showHint && (
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(251,191,36,0.1)', border: '1px solid var(--gold)', borderRadius: '8px', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '1px' }}>Ledtråd</span>
          <p style={{ marginTop: '6px', color: 'var(--fg)' }}>{hint}</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors in `components/games/SharedSecret.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/games/SharedSecret.tsx
git commit -m "feat: add SharedSecret game component with distributed clues and Realtime sync"
```

---

## Task 6: Wire Into ChallengeScreen + play/page.tsx

**Files:**
- Modify: `components/screens/ChallengeScreen.tsx`
- Modify: `app/play/page.tsx`

### Part A: ChallengeScreen.tsx

- [ ] **Step 1: Add `memberId` and `startedAtMs` to ChallengeScreen Props**

Find the `type Props` block (line 36) and add the new optional fields:

```ts
type Props = {
  missionId: string;
  team: Team;
  game: Game;
  teams?: Team[];
  customMissions?: Mission[];
  memberId?: string;
  onDone: (updatedTeam: Team, pts: number, correct: boolean, elapsed: number) => void;
  onBack: () => void;
};
```

Update the destructuring on line 45 to include `memberId = ''`:

```ts
export default function ChallengeScreen({ missionId, team, game, teams = [], customMissions = [], memberId = '', onDone, onBack }: Props) {
```

- [ ] **Step 2: Add a `startedAtMs` ref**

After the existing `const elapsedRef = useRef(0);` line, add:

```ts
const startedAtMsRef = useRef(Date.now());
```

- [ ] **Step 3: Add imports for the two new components**

After the last import (TextQuiz), add:

```ts
import RelayMission from '@/components/games/RelayMission';
import SharedSecret from '@/components/games/SharedSecret';
```

- [ ] **Step 4: Add `case 'relay'` and `case 'shared_secret'` to `renderGame()`**

Find the end of the switch in `renderGame()` (before `default:`), and add:

```ts
      case 'relay':
        return (
          <RelayMission
            mission={mission}
            team={team}
            game={game}
            memberId={memberId}
            effectiveMaxPts={effectiveMaxPts}
            onFinish={(correct, pts) => finish(correct, pts)}
          />
        );
      case 'shared_secret':
        return (
          <SharedSecret
            mission={mission}
            team={team}
            game={game}
            memberId={memberId}
            effectiveMaxPts={effectiveMaxPts}
            startedAtMs={startedAtMsRef.current}
            onFinish={(correct, pts) => finish(correct, pts)}
          />
        );
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

### Part B: play/page.tsx — pass memberId to ChallengeScreen

- [ ] **Step 6: Find the ChallengeScreen render call in play/page.tsx**

Search for `<ChallengeScreen` in `app/play/page.tsx`. There should be one render call. Add the `memberId` prop:

```tsx
<ChallengeScreen
  missionId={activeMission!}
  team={team}
  game={game}
  teams={teams}
  customMissions={customMissions}
  memberId={memberId ?? ''}
  onDone={handleMissionDone}
  onBack={handleBack}
/>
```

(The `memberId` variable comes from the existing login state — it is already stored in the `memberId` state variable from the login response.)

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add components/screens/ChallengeScreen.tsx app/play/page.tsx
git commit -m "feat: wire relay + shared_secret into ChallengeScreen; pass memberId prop"
```

---

## Task 7: AdminScreen — Custom Form Extension

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

The admin can create custom relay and shared_secret missions. We need to:
1. Add `'relay'` and `'shared_secret'` to the type selector options.
2. Add dynamic form fields: relay shows a list of segment prompts; shared_secret shows a list of clues + answer + optional hint fields.
3. Add `relaySegments` and `relayMode` to `MissionFormData`.

**Note:** AdminScreen is large (~3700 lines). Make targeted, surgical edits. Read the file first to get exact line numbers before editing.

- [ ] **Step 1: Read the current MissionFormData type**

Search AdminScreen.tsx for `MissionFormData`. It currently has these fields:
`name, icon, desc, difficulty, maxPts, type, triviaRounds, statements, closestQuestions, clues, paAnswer, timelineItems, photoPrompt, activeFrom, activeUntil`

Add `relaySegments` and `relayMode` to `MissionFormData`:

Find the line containing `photoPrompt: string;` in the `MissionFormData` type and add after it:

```ts
relaySegments: string[];          // relay: one entry per segment prompt
relayMode: 'typerace' | 'button'; // relay: how member completes each segment
sharedSecretAnswer: string;       // shared_secret: the answer
sharedSecretHint: string;         // shared_secret: optional hint (uses clues[] for the clues)
```

- [ ] **Step 2: Update `initialMissionForm` to include the new fields**

Find the `initialMissionForm` object (or wherever `missionForm` state is initialized) and add:

```ts
relaySegments: ['', '', '', ''],
relayMode: 'typerace' as const,
sharedSecretAnswer: '',
sharedSecretHint: '',
```

- [ ] **Step 3: Add relay + shared_secret to the type selector**

Find the `<select>` or radio group where mission type is chosen. It currently lists types like `trivia_quiz`, `truefalse`, etc. Add:

```tsx
<option value="relay">Stafett (Relay)</option>
<option value="shared_secret">Hemligt ord (Shared Secret)</option>
```

- [ ] **Step 4: Add relay segment fields**

Find where `{missionForm.type === 'trivia_quiz' && (...)}` is rendered and add alongside:

```tsx
{missionForm.type === 'relay' && (
  <div>
    <div style={{ marginBottom: '8px', fontWeight: 600 }}>Segmentuppmaningar</div>
    <div style={{ marginBottom: '8px' }}>
      <label style={{ fontSize: '13px', color: 'var(--muted)' }}>Relä-typ</label>
      <select
        value={missionForm.relayMode}
        onChange={e => setMissionForm(f => ({ ...f, relayMode: e.target.value as 'typerace' | 'button' }))}
      >
        <option value="typerace">Skrivstafett — deltagaren skriver texten exakt</option>
        <option value="button">Knapptafett — deltagaren klickar Klar</option>
      </select>
    </div>
    {missionForm.relaySegments.map((seg, i) => (
      <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
        <span style={{ color: 'var(--muted)', minWidth: '20px', fontSize: '13px' }}>{i + 1}.</span>
        <input
          type="text"
          placeholder={`Segment ${i + 1} text…`}
          value={seg}
          onChange={e => {
            const next = [...missionForm.relaySegments];
            next[i] = e.target.value;
            setMissionForm(f => ({ ...f, relaySegments: next }));
          }}
          style={{ flex: 1 }}
        />
        {missionForm.relaySegments.length > 2 && (
          <button
            type="button"
            className="btn"
            style={{ padding: '4px 8px', fontSize: '12px' }}
            onClick={() => {
              const next = missionForm.relaySegments.filter((_, idx) => idx !== i);
              setMissionForm(f => ({ ...f, relaySegments: next }));
            }}
          >✕</button>
        )}
      </div>
    ))}
    <button
      type="button"
      className="btn"
      style={{ fontSize: '13px', marginTop: '4px' }}
      onClick={() => setMissionForm(f => ({ ...f, relaySegments: [...f.relaySegments, ''] }))}
    >
      + Lägg till segment
    </button>
  </div>
)}
```

- [ ] **Step 5: Add shared_secret fields**

The shared_secret uses the existing `clues` array in `missionForm` for the distributed clues (add min 2 clue message if needed), plus two new fields for `sharedSecretAnswer` and `sharedSecretHint`.

```tsx
{missionForm.type === 'shared_secret' && (
  <div>
    <div style={{ marginBottom: '8px', fontWeight: 600 }}>Ledtrådar (en per deltagare)</div>
    {missionForm.clues.map((clue, i) => (
      <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
        <span style={{ color: 'var(--muted)', minWidth: '20px', fontSize: '13px' }}>{i + 1}.</span>
        <input
          type="text"
          placeholder={`Ledtråd ${i + 1}…`}
          value={clue}
          onChange={e => {
            const next = [...missionForm.clues];
            next[i] = e.target.value;
            setMissionForm(f => ({ ...f, clues: next }));
          }}
          style={{ flex: 1 }}
        />
        {missionForm.clues.length > 2 && (
          <button
            type="button"
            className="btn"
            style={{ padding: '4px 8px', fontSize: '12px' }}
            onClick={() => {
              const next = missionForm.clues.filter((_, idx) => idx !== i);
              setMissionForm(f => ({ ...f, clues: next }));
            }}
          >✕</button>
        )}
      </div>
    ))}
    <button
      type="button"
      className="btn"
      style={{ fontSize: '13px', marginTop: '4px' }}
      onClick={() => setMissionForm(f => ({ ...f, clues: [...f.clues, ''] }))}
    >
      + Lägg till ledtråd
    </button>

    <div style={{ marginTop: '16px' }}>
      <label style={{ fontSize: '13px', color: 'var(--muted)' }}>Svar (hemligt ord/kod)</label>
      <input
        type="text"
        placeholder="t.ex. salt"
        value={missionForm.sharedSecretAnswer}
        onChange={e => setMissionForm(f => ({ ...f, sharedSecretAnswer: e.target.value }))}
      />
    </div>

    <div style={{ marginTop: '12px' }}>
      <label style={{ fontSize: '13px', color: 'var(--muted)' }}>Extra ledtråd (valfri, visas efter 2 felförsök, kostar -50 poäng)</label>
      <input
        type="text"
        placeholder="t.ex. Tänk matlagning"
        value={missionForm.sharedSecretHint}
        onChange={e => setMissionForm(f => ({ ...f, sharedSecretHint: e.target.value }))}
      />
    </div>
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add relay + shared_secret fields to AdminScreen custom mission form"
```

---

## Task 8: lib/custom-missions.ts — toMission, validateMissionData, buildMissionData

**Files:**
- Modify: `lib/custom-missions.ts`

Custom missions for relay and shared_secret are stored in the `custom_missions` table with a JSONB `data` field. We need to handle these in all three functions.

**Relay data shape stored in DB:**
```json
{ "segments": ["prompt 1", "prompt 2", "prompt 3"], "relayMode": "typerace" }
```

**SharedSecret data shape stored in DB:**
```json
{ "clues": ["ledtråd 1", "ledtråd 2"], "answer": "salt", "hint": "Tänk matlagning" }
```

- [ ] **Step 1: Add `relay` and `shared_secret` cases to `toMission`**

In `lib/custom-missions.ts`, find the `switch (cm.type)` inside `toMission`. After the `case 'photo':` block, add before `default:`:

```ts
    case 'relay':
      return {
        ...base,
        relayMode: (d.relayMode as 'typerace' | 'button') ?? 'button',
        segments: ((d.segments as string[]) ?? []).map(p => ({ prompt: p })),
      };
    case 'shared_secret':
      return {
        ...base,
        clues: (d.clues as string[]) ?? [],
        answer: d.answer as string,
        hint: d.hint as string | undefined,
      };
```

- [ ] **Step 2: Update `validateMissionData` signature to accept new fields**

The `validateMissionData` function currently accepts a typed data object. Add `relaySegments`, `relayMode`, `sharedSecretAnswer`, and `sharedSecretHint` to its parameter:

```ts
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
    relaySegments: string[];
    relayMode: 'typerace' | 'button';
    sharedSecretAnswer: string;
    sharedSecretHint: string;
  }
): string | null {
```

- [ ] **Step 3: Add `relay` and `shared_secret` cases to `validateMissionData`**

After the `case 'photo':` block, before `default:`:

```ts
    case 'relay':
      if (data.relaySegments.filter(s => s.trim()).length < 2) return 'Add at least 2 segments.';
      if (data.relaySegments.some(s => !s.trim())) return 'All segments need text.';
      return null;
    case 'shared_secret':
      if (data.clues.filter(c => c.trim()).length < 2) return 'Add at least 2 clues.';
      if (data.clues.some(c => !c.trim())) return 'All clues need text.';
      if (!data.sharedSecretAnswer.trim()) return 'Answer is required.';
      return null;
```

- [ ] **Step 4: Update `buildMissionData` signature similarly**

Add `relaySegments`, `relayMode`, `sharedSecretAnswer`, `sharedSecretHint` to its parameter type:

```ts
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
    relaySegments: string[];
    relayMode: 'typerace' | 'button';
    sharedSecretAnswer: string;
    sharedSecretHint: string;
  }
): Record<string, unknown> {
```

- [ ] **Step 5: Add `relay` and `shared_secret` cases to `buildMissionData`**

After the `case 'photo':` block, before `default:`:

```ts
    case 'relay':
      return {
        segments: data.relaySegments.filter(s => s.trim()),
        relayMode: data.relayMode,
      };
    case 'shared_secret':
      return {
        clues: data.clues.filter(c => c.trim()),
        answer: data.sharedSecretAnswer.trim(),
        hint: data.sharedSecretHint.trim() || undefined,
      };
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Verify AdminScreen still passes the new fields**

AdminScreen calls `validateMissionData(type, missionForm)` and `buildMissionData(type, missionForm)`. After adding the new fields to `MissionFormData` (Task 7) and to the function signatures here, TypeScript will catch any mismatch. Confirm the tsc output above is clean.

- [ ] **Step 8: Commit**

```bash
git add lib/custom-missions.ts
git commit -m "feat: add relay + shared_secret cases to toMission, validateMissionData, buildMissionData"
```

---

## Final Build Verification

- [ ] **Run full TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Run Next.js build**

```bash
cd /Users/signevallin/Desktop/GameOn && npm run build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` or `Route (app)` table with no errors.

- [ ] **Push to main and deploy**

```bash
git push origin main
```

Verify Vercel deployment succeeds.

---

## Self-Review

### Spec Coverage

| Spec Requirement | Task |
|---|---|
| `relay` and `shared_secret` MissionType values | Task 2 |
| Relay `segments` data shape | Task 2 |
| SharedSecret `clues / answer / hint` data shape | Task 2 |
| `relay_state JSONB` column on teams | Task 1 |
| `relay_state` shape with activeIndex + segments | Task 3 |
| Time-decay scoring for relay | Task 4 (onFinish computation) |
| Time-decay + wrong-attempt penalty for shared_secret | Task 5 |
| Relay UX: active prompt + queue + Start button | Task 4 |
| Relay: offline timeout / auto-skip (60s) | Task 4 |
| SharedSecret: personal clue only per member | Task 5 |
| SharedSecret: any member can submit guess | Task 5 |
| SharedSecret: hint after 2 wrong attempts (-50) | Task 5 |
| Realtime `relay-advance` event | Tasks 4 |
| Realtime `secret-attempt` event | Task 5 |
| `POST /api/team/relay` API route | Task 3 |
| 4 built-in missions (relay_typerace, relay_trivia, secret_word, secret_code) | Task 2 |
| REMOTE super-category | Task 2 |
| AdminScreen custom form (relay segments + shared_secret clues) | Task 7 |
| lib/custom-missions.ts toMission/validate/build | Task 8 |
| ChallengeScreen routing | Task 6 |

All spec requirements are covered. ✅

### Type Consistency Check

- `RelayMission` receives `mission: Mission` (has `.segments`, `.relayMode`) — defined in Task 2 ✅
- `SharedSecret` receives `mission: Mission` (uses `.clues`, `.answer`, `.hint`) — existing fields ✅
- `ChallengeScreen` passes `memberId` (Task 6) which comes from `play/page.tsx` login state (Task 6 Part B) ✅
- `buildMissionData` returns `relay: { segments: string[], relayMode }` which `toMission` reads as `d.segments as string[]` ✅
- `relay API` returns `{ relayState: RelayMissionState, complete: boolean }` which `RelayMission.advance()` consumes ✅
- `relay-advance` broadcast payload `{ missionId, relayState }` matches what `RelayMission` listens for ✅
- `secret-attempt` broadcast payload `{ missionId, attempts, correct }` matches what `SharedSecret` listens for ✅
