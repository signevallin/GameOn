# Team UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three team/remote-mode UX issues: case-insensitive team name matching on join, forced screen sync in remote mode (all teammates follow navigation), and a collapsible member status panel under the team name.

**Architecture:** Feature 1 is a one-line change in the login route. Feature 2 adds a `synced_mission_id` column to `teams`, a new navigate API endpoint, and sync logic in `play/page.tsx` that piggybacks on the existing 500ms poll (remote mode only). Feature 3 is a UI-only change in `MissionsScreen.tsx` — team name becomes a toggle button that shows the member list in a dropdown.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (service-role client for API routes, anon client for frontend), React state + refs.

---

### Task 1: Case-insensitive team name lookup

**Files:**
- Modify: `app/api/team/login/route.ts`

- [ ] **Step 1: Fix the remote-mode team lookup**

Find line ~65 (the `.eq('game_id', game.id).eq('name', name.trim()).eq('join_code', ...)` chain). Change `.eq('name', name.trim())` to `.ilike('name', name.trim())`:

```typescript
    const [teamResult, customMissionsResult] = await Promise.all([
      supabase
        .from('teams')
        .select('*')
        .eq('game_id', game.id)
        .ilike('name', name.trim())
        .eq('join_code', joinCode.trim().toUpperCase())
        .single(),
      buildCustomMissionsPromise(),
    ]);
```

- [ ] **Step 2: Fix the classic-mode team lookup**

Find line ~160 (the `supabase.from('teams').select('*').eq('name', name.trim()).eq('game_id', game.id)` chain). Change `.eq('name', name.trim())` to `.ilike('name', name.trim())`:

```typescript
  const [teamResult, customMissionsResult] = await Promise.all([
    supabase.from('teams').select('*').ilike('name', name.trim()).eq('game_id', game.id).single(),
    buildCustomMissionsPromise(),
  ]);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add app/api/team/login/route.ts
git commit -m "fix(team): case-insensitive team name lookup on join"
```

---

### Task 2: DB migration + Team type + navigate endpoint

**Files:**
- Create: `supabase/migrations/20260610_team_screen_sync.sql`
- Modify: `lib/supabase.ts`
- Create: `app/api/team/navigate/route.ts`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260610_team_screen_sync.sql`:

```sql
-- supabase/migrations/20260610_team_screen_sync.sql

-- Shared current-mission state for remote-mode screen sync.
-- null  = team is on the missions list
-- non-null = team is viewing that mission's challenge screen
alter table public.teams
  add column if not exists synced_mission_id text;
```

- [ ] **Step 2: Apply the migration**

Run in the Supabase SQL editor (dashboard → SQL editor), or via CLI:

```bash
npx supabase db push
```

Verify by checking the `teams` table schema — `synced_mission_id` column should exist, nullable text.

- [ ] **Step 3: Add `synced_mission_id` to the Team type**

In `lib/supabase.ts`, add the new field to the `Team` type after the `members` field (around line 33):

```typescript
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
  synced_mission_id?: string | null;
};
```

- [ ] **Step 4: Create the navigate endpoint**

Create `app/api/team/navigate/route.ts`:

```typescript
// app/api/team/navigate/route.ts
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
  let body: { teamId?: unknown; missionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { teamId, missionId } = body;
  if (!teamId || typeof teamId !== 'string') {
    return NextResponse.json({ error: 'Missing teamId.' }, { status: 400 });
  }
  if (missionId !== null && missionId !== undefined && typeof missionId !== 'string') {
    return NextResponse.json({ error: 'missionId must be a string or null.' }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from('teams')
    .update({ synced_mission_id: (missionId as string | null) ?? null })
    .eq('id', teamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260610_team_screen_sync.sql lib/supabase.ts app/api/team/navigate/route.ts
git commit -m "feat(sync): add synced_mission_id column, Team type, and navigate endpoint"
```

---

### Task 3: Poll interval + sync logic + navigate calls in play/page.tsx

**Files:**
- Modify: `app/play/page.tsx`

This task has several small changes to the same file. Read the full file first, then apply all changes.

- [ ] **Step 1: Add refs for activeMission, screen, and syncedMission**

In `play/page.tsx`, after the existing ref declarations (lines ~38–43, where `teamRef`, `gameRef`, `memberIdRef` are defined), add:

```typescript
  // Refs so sync logic and navigate calls always read the latest values
  const activeMissionRef = useRef(activeMission);
  const screenRef = useRef(screen);
  const syncedMissionRef = useRef<string | null | undefined>(undefined);
  activeMissionRef.current = activeMission;
  screenRef.current = screen;
```

The `syncedMissionRef` starts as `undefined` (not `null`) so the first poll returning `null` (no one navigating yet) does not trigger a spurious navigation.

- [ ] **Step 2: Add the `navigateSync` helper function**

After the `handleSelectMission` function (around line 256), add:

```typescript
  async function navigateSync(missionId: string | null) {
    const t = teamRef.current;
    const g = gameRef.current;
    if (!t || !g?.remote_mode) return;
    try {
      await fetch('/api/team/navigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: t.id, missionId }),
        cache: 'no-store',
      });
    } catch { /* best-effort — same pattern as heartbeat */ }
  }
```

- [ ] **Step 3: Call navigateSync from handleSelectMission**

Change `handleSelectMission` (line ~253) from:

```typescript
  function handleSelectMission(id: string) {
    setActiveMission(id);
    setScreen('challenge');
  }
```

to:

```typescript
  function handleSelectMission(id: string) {
    setActiveMission(id);
    setScreen('challenge');
    navigateSync(id); // sync teammates in remote mode
  }
```

- [ ] **Step 4: Call navigateSync on Back from challenge and result screens**

Find the `onBack` prop on `ChallengeScreen` (line ~328):

```typescript
        onBack={() => setScreen('missions')}
```

Change to:

```typescript
        onBack={() => { setScreen('missions'); navigateSync(null); }}
```

Find the `onBack` prop on `ResultScreen` (line ~341):

```typescript
        onBack={() => setScreen('missions')}
```

Change to:

```typescript
        onBack={() => { setScreen('missions'); navigateSync(null); }}
```

- [ ] **Step 5: Change poll interval to 500ms in remote mode**

In the polling `useEffect` (around line 96–127), change:

```typescript
    const id = setInterval(refresh, 5000);
```

to:

```typescript
    const id = setInterval(refresh, gameRef.current?.remote_mode ? 500 : 5000);
```

Also update the dependency array comment and the array itself. Change:

```typescript
  }, [hydrated, screen === 'missions' || screen === 'challenge' || screen === 'result']);
```

to:

```typescript
  }, [hydrated, screen === 'missions' || screen === 'challenge' || screen === 'result', !!game?.remote_mode]);
```

Adding `!!game?.remote_mode` ensures the interval restarts (with the correct 500ms) when the game first loads and `remote_mode` becomes known.

- [ ] **Step 6: Add sync logic inside the `refresh` function**

Inside the `refresh` async function, after `if (data.team) setTeam(data.team);` (line ~114), add:

```typescript
        // ── Remote mode screen sync ──────────────────────────────────────
        if (data.team && gameRef.current?.remote_mode) {
          const incoming = (data.team as { synced_mission_id?: string | null }).synced_mission_id ?? null;
          if (incoming !== syncedMissionRef.current) {
            syncedMissionRef.current = incoming;
            if (incoming !== null && incoming !== activeMissionRef.current) {
              // A teammate navigated to a mission — follow them
              setActiveMission(incoming);
              setScreen('challenge');
            } else if (incoming === null && screenRef.current === 'challenge') {
              // A teammate went back to missions — follow them
              setActiveMission(null);
              setScreen('missions');
            }
          }
        }
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

- [ ] **Step 8: Commit**

```bash
git add app/play/page.tsx
git commit -m "feat(sync): forced screen sync in remote mode — 500ms poll, navigate calls, sync logic"
```

---

### Task 4: Collapsible member status under team name

**Files:**
- Modify: `components/screens/MissionsScreen.tsx`

- [ ] **Step 1: Add `showMembers` state to the MissionsScreen component**

In `MissionsScreen.tsx`, find the start of the main component function (search for `export default function MissionsScreen` or the first `useState` in the component body). Add after the first useState declarations:

```typescript
  const [showMembers, setShowMembers] = useState(false);
```

- [ ] **Step 2: Replace the team name span with a conditional button**

Find the nav col 1 block (around line 798–801):

```typescript
        {/* Col 1: team name */}
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {team.name}
        </span>
```

Replace with:

```typescript
        {/* Col 1: team name — button in remote mode, span otherwise */}
        {game.remote_mode ? (
          <button
            onClick={() => setShowMembers(v => !v)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--text)',
              overflow: 'hidden',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {team.name}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--muted)', flexShrink: 0 }}>
              {showMembers ? '▴' : '▾'}
            </span>
          </button>
        ) : (
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {team.name}
          </span>
        )}
```

- [ ] **Step 3: Add the dropdown panel after the nav closing tag**

Find the `</nav>` closing tag (around line 860) and the line immediately after it that renders `MemberBar`:

```typescript
      </nav>

      {game.remote_mode && members.length > 0 && (
        <MemberBar members={members} currentMemberId={memberId} />
      )}
```

Replace that whole block (the `</nav>` stays, only what follows changes) with:

```typescript
      </nav>

      {game.remote_mode && showMembers && members.length > 0 && (
        <div style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '8px 16px',
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          {members.map(m => (
            <div key={m.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '4px 10px',
              borderRadius: '20px',
              background: m.id === memberId ? 'rgba(124,189,212,0.12)' : 'var(--card)',
              border: `1px solid ${m.id === memberId ? 'rgba(124,189,212,0.4)' : 'var(--border)'}`,
              fontSize: '12px',
              fontWeight: m.id === memberId ? 700 : 500,
              color: 'var(--text)',
            }}>
              <span style={{ fontSize: '8px', color: m.online ? 'var(--accent3)' : 'var(--muted)' }}>●</span>
              {m.name}
            </div>
          ))}
        </div>
      )}
```

Note: the inline styles are intentionally copied from the existing `MemberBar` component so the visual appearance is identical — just now it's togglable.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add components/screens/MissionsScreen.tsx
git commit -m "feat(ux): collapsible member status panel under team name"
```

---

### Task 5: Final TypeScript check + push

**Files:**
- No new files

- [ ] **Step 1: Full TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors). Fix any errors before proceeding.

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully` (or equivalent). Fix any build errors.

- [ ] **Step 3: Push to origin**

```bash
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ Feature 1: `.ilike()` in both classic and remote-mode login paths (Task 1)
- ✅ Feature 2: `synced_mission_id` column (Task 2), navigate endpoint (Task 2), 500ms poll in remote mode (Task 3), sync logic in refresh (Task 3), navigate calls on forward and back navigation (Task 3)
- ✅ Feature 3: team name button, dropdown panel, MemberBar row removed (Task 4)

**Type consistency:**
- `synced_mission_id?: string | null` added to `Team` in `lib/supabase.ts` (Task 2) and cast as `{ synced_mission_id?: string | null }` in the poll handler (Task 3, Step 6) — consistent.
- `navigateSync(missionId: string | null)` defined in Task 3 Step 2, called in Steps 3 and 4 — consistent.
- `syncedMissionRef.current` typed `string | null | undefined` — the `undefined` initial value is intentional and documented.

**No placeholders:** all steps contain complete code.
