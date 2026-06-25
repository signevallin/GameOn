# Team UX Fixes — Design Spec

## Goal

Three targeted improvements to the team/remote-mode experience:

1. **Team name typo tolerance** — case-insensitive team lookup on join
2. **Forced screen sync in remote mode** — when any team member navigates to a mission (or back), all teammates follow automatically
3. **Collapsible member status** — team name in the nav bar becomes a toggle that expands to show who is online

---

## Feature 1: Team Name Typo Tolerance

### Problem

When joining an existing team, the name lookup uses exact case matching. "Team A" and "team a" are treated as different teams, causing accidental duplicate teams.

### Fix

**File:** `app/api/team/login/route.ts`

Replace `.eq('name', name.trim())` with `.ilike('name', name.trim())` in both lookup paths:

- **Remote mode** (line ~65): the `.eq('game_id', ...).eq('name', ...).eq('join_code', ...)` chain
- **Classic mode** (line ~160): the `.eq('name', ...).eq('game_id', ...)` chain

`ilike` is Supabase's case-insensitive `LIKE` with no wildcard — equivalent to `LOWER(name) = LOWER($1)`.

No schema change required. Whitespace is already trimmed on both sides before comparison.

---

## Feature 2: Forced Screen Sync (Remote Mode)

### Problem

In remote mode, each team member's screen is independent. When one member taps a mission, teammates are left on the missions list and have to navigate there manually.

### Design

**Shared state on the team row.** Any navigation change is written to the `teams` table; all clients pick it up via the existing poll. No new polling infrastructure or Supabase Realtime needed.

### Schema Change

```sql
ALTER TABLE teams ADD COLUMN synced_mission_id text;
```

Nullable. `null` = missions list, non-null = team is on that challenge.

### New API Endpoint: `POST /api/team/navigate`

```typescript
// Body
{ teamId: string; missionId: string | null }

// Action
UPDATE teams SET synced_mission_id = $missionId WHERE id = $teamId

// Response
{ ok: true }
```

No auth required beyond `teamId` presence (consistent with the poll and heartbeat endpoints).

### Client — When to Call `/api/team/navigate`

In `app/play/page.tsx`:

| Event | Call |
|-------|------|
| `handleSelectMission(id)` — entering a challenge | `navigate(teamId, id)` |
| Back button from challenge → missions | `navigate(teamId, null)` |
| Back button from result → missions | `navigate(teamId, null)` |

The call is fire-and-forget (best-effort, silent on error — same pattern as heartbeat).

### Poll Interval Change

In `app/play/page.tsx`, the `setInterval(refresh, 5000)` call changes to:

```typescript
const id = setInterval(refresh, gameRef.current?.remote_mode ? 500 : 5000);
```

Add `!!game?.remote_mode` to the `useEffect` dependency array so the interval restarts when remote mode is first determined (game loads).

### Client — Sync Logic

After each poll response, if `data.team` is present and the game is in remote mode, compare `data.team.synced_mission_id` with a `syncedMissionRef` (a ref that tracks the last known `synced_mission_id`):

```typescript
const syncedMissionRef = useRef<string | null | undefined>(undefined);

// Inside refresh(), after setting team:
if (data.team && gameRef.current?.remote_mode) {
  const incoming = data.team.synced_mission_id ?? null;
  if (incoming !== syncedMissionRef.current) {
    syncedMissionRef.current = incoming;
    if (incoming !== null && incoming !== activeMissionRef.current) {
      // Someone navigated to a mission — follow
      setActiveMission(incoming);
      setScreen('challenge');
    } else if (incoming === null && screenRef.current === 'challenge') {
      // Someone went back — follow
      setActiveMission(null);
      setScreen('missions');
    }
  }
}
```

Using `undefined` as the initial ref value means the first poll never triggers a spurious navigate (the comparison `undefined !== null` is true, but we only navigate when `incoming !== null`, so going from `undefined → null` on first load does nothing).

### Type Change

In `lib/supabase.ts`, add to the `Team` type:

```typescript
synced_mission_id?: string | null;
```

### `activeMissionRef` and `screenRef`

`play/page.tsx` already uses refs for poll-stable reads. Add:

```typescript
const activeMissionRef = useRef(activeMission);
useEffect(() => { activeMissionRef.current = activeMission; }, [activeMission]);

const screenRef = useRef(screen);
useEffect(() => { screenRef.current = screen; }, [screen]);
```

(If `activeMissionRef` already exists — check before adding.)

---

## Feature 3: Collapsible Member Status

### Problem

The MemberBar is always visible as a separate row below the nav in remote mode, taking up vertical space. Members can't hide it when they don't need it.

### Design

**Team name becomes a button in remote mode.** Tapping it toggles a dropdown panel that shows the member list. The existing standalone MemberBar row is removed.

### Changes in `components/screens/MissionsScreen.tsx`

**New state:**
```typescript
const [showMembers, setShowMembers] = useState(false);
```

**Nav col 1 — team name:**

```tsx
{/* Col 1: team name */}
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

**Dropdown panel** — rendered immediately after the `<nav>` closing tag, before the container div:

```tsx
{game.remote_mode && showMembers && members.length > 0 && (
  <div style={{
    background: 'rgba(255,255,255,0.04)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    padding: '8px 16px',
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  }}>
    {members.map(m => (
      <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: m.id === memberId ? 'var(--text)' : 'var(--muted)' }}>
        <span style={{ fontSize: '8px', color: m.online ? 'var(--accent3)' : 'var(--muted)' }}>●</span>
        {m.name}
      </div>
    ))}
  </div>
)}
```

**Remove the standalone MemberBar row:**

```tsx
// DELETE this block:
{game.remote_mode && members.length > 0 && (
  <MemberBar members={members} currentMemberId={memberId} />
)}
```

The `MemberBar` component itself can remain (it may be used elsewhere) — just remove this one render site.

---

## Files Changed

| File | Change |
|------|--------|
| `app/api/team/login/route.ts` | `.eq('name', ...)` → `.ilike('name', ...)` in 2 places |
| `app/api/team/navigate/route.ts` | New file — updates `synced_mission_id` on team |
| `lib/supabase.ts` | Add `synced_mission_id?: string \| null` to `Team` type |
| `app/play/page.tsx` | Poll interval logic, `syncedMissionRef`, navigate calls, `activeMissionRef`/`screenRef` |
| `components/screens/MissionsScreen.tsx` | Collapsible team name button, dropdown panel, remove MemberBar row |
| Supabase migration | `ALTER TABLE teams ADD COLUMN synced_mission_id text` |

---

## Out of Scope

- Studio/Pro plan restrictions on remote mode (unchanged)
- Syncing the result screen (result is personal — each member sees their own)
- Animations on the dropdown panel
- Conflict resolution when two members navigate simultaneously (last write wins)
