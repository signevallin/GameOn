# Superadmin Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only analytics dashboard to the superadmin "Customers" tab showing KPIs, an expandable customer list, and a mission rankings panel.

**Architecture:** A new POST API route (`/api/admin/superadmin/analytics`) fetches all games + teams in parallel, computes KPIs/customer summaries/mission stats, and returns structured JSON. The existing AdminScreen "Customers" tab is replaced with a two-column analytics layout — KPI cards on top, customer list on the left, mission rankings on the right — keeping the same `tab === 'customers'` key to avoid broader refactoring.

**Tech Stack:** Next.js App Router API routes, Supabase service-role client, React inline styles, TypeScript

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/api/admin/superadmin/analytics/route.ts` | Create | Fetch & aggregate analytics data for superadmin |
| `components/screens/AdminScreen.tsx` | Modify | Replace customers UI with analytics layout |

---

### Task 1: Analytics API Route

**Files:**
- Create: `app/api/admin/superadmin/analytics/route.ts`

No test framework is set up — verify manually using the browser network tab or curl after implementation.

- [ ] **Step 1: Create the route file with the full implementation**

```typescript
// app/api/admin/superadmin/analytics/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { MISSIONS } from '@/lib/missions';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface AnalyticsGame {
  id: string;
  name: string | null;
  teamCount: number;
  topScore: number;
  finished: boolean;
  startedAt: string | null;
}

export interface AnalyticsCustomer {
  id: string;
  email: string;
  gameCount: number;
  avgTeams: number;
  completionRate: number;
  lastActive: string | null;
  games: AnalyticsGame[];
}

export interface AnalyticsMissionStat {
  id: string;
  name: string;
  gameCount: number;
  completedCount: number;
  totalTeams: number;
  completionRate: number;
}

export interface AnalyticsKPIs {
  totalGames: number;
  finishedGames: number;
  activeCustomers: number;
  activeCustomers30d: number;
  completionRate: number;
  avgTeamsPerGame: number;
  totalTeams: number;
}

export interface AnalyticsResponse {
  kpis: AnalyticsKPIs;
  customers: AnalyticsCustomer[];
  missionStats: AnalyticsMissionStat[];
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin?.isSuperAdmin) return unauthorizedResponse();

  const supabase = adminClient();

  // Fetch in parallel
  const [usersResult, gamesResult, teamsResult] = await Promise.all([
    supabase.auth.admin.listUsers(),
    supabase
      .from('games')
      .select('id, name, user_id, status, started_at, missions')
      .order('started_at', { ascending: false }),
    supabase
      .from('teams')
      .select('game_id, score, completed, finished_at'),
  ]);

  if (usersResult.error) {
    return NextResponse.json({ error: usersResult.error.message }, { status: 500 });
  }
  if (gamesResult.error) {
    return NextResponse.json({ error: gamesResult.error.message }, { status: 500 });
  }

  const users = usersResult.data.users;
  const games = gamesResult.data ?? [];
  const teams = teamsResult.data ?? [];

  // Build a lookup: game_id → array of teams
  const teamsByGame: Record<string, { score: number; completed: string[]; finished_at: string | null }[]> = {};
  for (const t of teams) {
    if (!teamsByGame[t.game_id]) teamsByGame[t.game_id] = [];
    teamsByGame[t.game_id].push({
      score: t.score ?? 0,
      completed: (t.completed ?? []) as string[],
      finished_at: t.finished_at ?? null,
    });
  }

  // Build a lookup: mission_id → mission name
  const missionNameById: Record<string, string> = {};
  for (const m of MISSIONS) {
    missionNameById[m.id] = m.name;
  }

  // ── KPIs ────────────────────────────────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const finishedGames = games.filter(g => g.status === 'finished').length;
  const customerIdsWithGames = new Set(games.map(g => g.user_id).filter(Boolean));
  const customerIdsActive30d = new Set(
    games
      .filter(g => g.started_at && g.started_at >= thirtyDaysAgo)
      .map(g => g.user_id)
      .filter(Boolean)
  );
  const totalTeamCount = teams.length;
  const avgTeamsPerGame = games.length > 0 ? totalTeamCount / games.length : 0;

  const kpis: AnalyticsKPIs = {
    totalGames: games.length,
    finishedGames,
    activeCustomers: customerIdsWithGames.size,
    activeCustomers30d: customerIdsActive30d.size,
    completionRate: games.length > 0 ? finishedGames / games.length : 0,
    avgTeamsPerGame: Math.round(avgTeamsPerGame * 10) / 10,
    totalTeams: totalTeamCount,
  };

  // ── Customers ────────────────────────────────────────────────────────────
  // Build per-customer game summaries
  const gamesByUser: Record<string, typeof games> = {};
  for (const g of games) {
    if (!g.user_id) continue;
    if (!gamesByUser[g.user_id]) gamesByUser[g.user_id] = [];
    gamesByUser[g.user_id].push(g);
  }

  const customers: AnalyticsCustomer[] = users
    .filter(u => u.app_metadata?.role !== 'superadmin') // exclude superadmins from list
    .map(u => {
      const userGames = gamesByUser[u.id] ?? [];
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
      // Games are already ordered by started_at desc from the query
      const lastActive = userGames.length > 0 ? (userGames[0].started_at ?? null) : null;
      const finishedCount = userGames.filter(g => g.status === 'finished').length;
      const totalTeamsForUser = userGames.reduce((sum, g) => sum + (teamsByGame[g.id]?.length ?? 0), 0);
      const avgTeams = userGames.length > 0 ? totalTeamsForUser / userGames.length : 0;

      return {
        id: u.id,
        email: u.email ?? '(no email)',
        gameCount: userGames.length,
        avgTeams: Math.round(avgTeams * 10) / 10,
        completionRate: userGames.length > 0 ? finishedCount / userGames.length : 0,
        lastActive,
        games: userGameDetails,
      };
    })
    .filter(c => c.gameCount > 0) // only show customers who have games
    .sort((a, b) => {
      if (!a.lastActive && !b.lastActive) return 0;
      if (!a.lastActive) return 1;
      if (!b.lastActive) return -1;
      return b.lastActive.localeCompare(a.lastActive);
    });

  // ── Mission stats ─────────────────────────────────────────────────────────
  // For each mission: count distinct games that included it, total teams in those games,
  // and total teams that completed it.
  const missionStatsMap: Record<string, { gameCount: number; totalTeams: number; completedCount: number }> = {};

  for (const g of games) {
    const missionIds: string[] = (g.missions ?? []) as string[];
    const gt = teamsByGame[g.id] ?? [];
    for (const mId of missionIds) {
      if (!missionStatsMap[mId]) {
        missionStatsMap[mId] = { gameCount: 0, totalTeams: 0, completedCount: 0 };
      }
      missionStatsMap[mId].gameCount += 1;
      missionStatsMap[mId].totalTeams += gt.length;
      missionStatsMap[mId].completedCount += gt.filter(t => t.completed.includes(mId)).length;
    }
  }

  const missionStats: AnalyticsMissionStat[] = Object.entries(missionStatsMap)
    .map(([id, s]) => ({
      id,
      name: missionNameById[id] ?? id,
      gameCount: s.gameCount,
      completedCount: s.completedCount,
      totalTeams: s.totalTeams,
      completionRate: s.totalTeams > 0 ? s.completedCount / s.totalTeams : 0,
    }))
    .sort((a, b) => b.gameCount - a.gameCount);

  const response: AnalyticsResponse = { kpis, customers, missionStats };
  return NextResponse.json(response);
}
```

- [ ] **Step 2: Verify the route builds without TypeScript errors**

```bash
cd /Users/signevallin/Desktop/GameOn
npx tsc --noEmit 2>&1 | grep -E "analytics|error" | head -20
```

Expected: No errors related to `analytics/route.ts`. Fix any type errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/superadmin/analytics/route.ts
git commit -m "feat: add superadmin analytics API route"
```

---

### Task 2: Analytics UI in AdminScreen

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

This task touches a large file (~2200 lines). All changes are confined to:
1. New state declarations near line 406
2. Replacing `loadCustomers()` function at line 741
3. Replacing the tab button label at line 1636
4. Replacing the entire `{tab === 'customers' && ...}` block starting at line 2135

- [ ] **Step 1: Add the analytics response type and new state variables**

Find this block near line 406:
```typescript
  const [customers, setCustomers] = useState<{ id: string; email: string; created_at: string; last_sign_in_at: string | null; game_count: number; is_super_admin: boolean }[]>([]);
```

Replace it with:
```typescript
  const [customers, setCustomers] = useState<{ id: string; email: string; created_at: string; last_sign_in_at: string | null; game_count: number; is_super_admin: boolean }[]>([]);

  // Analytics state
  type AnalyticsGame = { id: string; name: string | null; teamCount: number; topScore: number; finished: boolean; startedAt: string | null };
  type AnalyticsCustomer = { id: string; email: string; gameCount: number; avgTeams: number; completionRate: number; lastActive: string | null; games: AnalyticsGame[] };
  type AnalyticsMissionStat = { id: string; name: string; gameCount: number; completedCount: number; totalTeams: number; completionRate: number };
  type AnalyticsKPIs = { totalGames: number; finishedGames: number; activeCustomers: number; activeCustomers30d: number; completionRate: number; avgTeamsPerGame: number; totalTeams: number };
  type AnalyticsData = { kpis: AnalyticsKPIs; customers: AnalyticsCustomer[]; missionStats: AnalyticsMissionStat[] };

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
```

**Note:** TypeScript type declarations inside a function component are fine for co-location but will cause re-declaration errors if the component re-renders with `type` in a closure. Since these are `type` aliases (not `interface`), they're erased at compile time and don't cause runtime issues.

- [ ] **Step 2: Replace `loadCustomers()` with `loadAnalytics()`**

Find (around line 741):
```typescript
  async function loadCustomers() {
    const res = await POST('/api/admin/superadmin/users');
    const data = await res.json();
    if (data.users) setCustomers(data.users);
  }
```

Replace with:
```typescript
  async function loadCustomers() {
    const res = await POST('/api/admin/superadmin/users');
    const data = await res.json();
    if (data.users) setCustomers(data.users);
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try {
      const res = await POST('/api/admin/superadmin/analytics');
      const data = await res.json();
      if (data.kpis) setAnalytics(data);
    } finally {
      setAnalyticsLoading(false);
    }
  }
```

- [ ] **Step 3: Update the tab button to say "Analytics" and call `loadAnalytics`**

Find (around line 1636):
```typescript
            <button className={`admin-tab${tab === 'customers' ? ' active' : ''}`} onClick={() => { setTab('customers'); loadCustomers(); }}>👥 Customers</button>
```

Replace with:
```typescript
            <button className={`admin-tab${tab === 'customers' ? ' active' : ''}`} onClick={() => { setTab('customers'); loadAnalytics(); }}>📊 Analytics</button>
```

- [ ] **Step 4: Replace the customers tab JSX with the analytics layout**

Find the entire block starting at line 2135 (it ends at line 2167):
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

Replace with the following complete block:

```typescript
        {/* ANALYTICS — super-admin only */}
        {tab === 'customers' && isSuperAdmin && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Analytics</h2>
              {analytics && <span className="badge">{analytics.kpis.totalGames} spel</span>}
            </div>

            {analyticsLoading && (
              <div className="empty-state">Laddar analytics...</div>
            )}

            {!analyticsLoading && !analytics && (
              <div className="empty-state">Ingen data ännu.</div>
            )}

            {analytics && (() => {
              const { kpis, customers: analyticsCustomers, missionStats } = analytics;

              // Helper: color-code completion rate
              function rateColor(rate: number) {
                if (rate >= 0.8) return 'var(--accent3)';   // green
                if (rate >= 0.5) return 'var(--gold)';      // yellow
                return 'var(--accent2)';                     // red/pink
              }

              return (
                <>
                  {/* ── KPI Cards ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                    {/* Total games */}
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Totalt spel</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{kpis.totalGames}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{kpis.finishedGames} avslutade</div>
                    </div>
                    {/* Active customers */}
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Aktiva kunder</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{kpis.activeCustomers}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{kpis.activeCustomers30d} aktiva senaste 30d</div>
                    </div>
                    {/* Completion rate */}
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Spelklar-rate</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: rateColor(kpis.completionRate) }}>{Math.round(kpis.completionRate * 100)}%</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>spel som slutförts</div>
                    </div>
                    {/* Avg teams */}
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Snitt lag/spel</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{kpis.avgTeamsPerGame}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>totalt {kpis.totalTeams} lag</div>
                    </div>
                  </div>

                  {/* ── Two-column layout ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>

                    {/* Left: Customer list */}
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>
                        Kunder ({analyticsCustomers.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {analyticsCustomers.length === 0 && (
                          <div className="empty-state">Inga kunder ännu.</div>
                        )}
                        {analyticsCustomers.map(c => (
                          <div key={c.id}>
                            {/* Customer row */}
                            <div
                              onClick={() => setExpandedCustomer(expandedCustomer === c.id ? null : c.id)}
                              style={{
                                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: expandedCustomer === c.id ? '12px 12px 0 0' : '12px',
                                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {c.email}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                                  {c.lastActive ? new Date(c.lastActive).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Inget spel'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>{c.gameCount}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>spel</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)' }}>{c.avgTeams}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>lag/spel</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: rateColor(c.completionRate) }}>{Math.round(c.completionRate * 100)}%</div>
                                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>klar</div>
                                </div>
                                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{expandedCustomer === c.id ? '▲' : '▼'}</div>
                              </div>
                            </div>
                            {/* Expanded: individual games */}
                            {expandedCustomer === c.id && (
                              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '6px 0' }}>
                                {c.games.length === 0 && (
                                  <div style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--muted)' }}>Inga spel.</div>
                                )}
                                {c.games.map(g => (
                                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', gap: '10px', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {g.name ?? '(namnlöst)'}
                                      </div>
                                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>
                                        {g.startedAt ? new Date(g.startedAt).toLocaleDateString('sv-SE') : '—'}
                                      </div>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>{g.teamCount} lag</div>
                                    <div style={{ fontSize: '11px', color: 'var(--accent)', flexShrink: 0, fontWeight: 700 }}>{g.topScore}p</div>
                                    <div style={{ fontSize: '11px', flexShrink: 0, color: g.finished ? 'var(--accent3)' : 'var(--muted)' }}>
                                      {g.finished ? '✓' : '—'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: Mission rankings */}
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>
                        Uppdragsranking
                      </div>
                      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                        {/* Header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 70px', gap: '8px', padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          <div>Uppdrag</div>
                          <div style={{ textAlign: 'right' }}>Spel</div>
                          <div style={{ textAlign: 'right' }}>Klarade</div>
                        </div>
                        {/* Rows */}
                        {missionStats.length === 0 && (
                          <div style={{ padding: '16px 14px', fontSize: '12px', color: 'var(--muted)' }}>Ingen data.</div>
                        )}
                        {missionStats.map(m => (
                          <div key={m.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 70px', gap: '8px', alignItems: 'center', marginBottom: '5px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'right' }}>{m.gameCount}</div>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: rateColor(m.completionRate), textAlign: 'right' }}>{Math.round(m.completionRate * 100)}%</div>
                            </div>
                            {/* Progress bar */}
                            <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.round(m.completionRate * 100)}%`, background: rateColor(m.completionRate), borderRadius: '2px' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </>
              );
            })()}

          </div>
        )}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "AdminScreen|error" | head -20
```

Expected: No errors. Fix any type errors before continuing.

- [ ] **Step 6: Run the dev server and open the app as superadmin**

```bash
npm run dev
```

Open http://localhost:3000, log in as superadmin, click "📊 Analytics" tab.

Verify:
- KPI cards load with real numbers
- Customer list shows rows sorted by most recent activity
- Clicking a customer row expands to show individual games
- Mission rankings show with progress bars
- Color coding works (green ≥80%, yellow 50-79%, red <50%)

- [ ] **Step 7: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: replace customers tab with analytics dashboard"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| 4 KPI cards (total games, active customers, completion rate, avg teams) | Task 2 Step 4 |
| Customer list sorted by most recent activity | Task 1 (sort in API), Task 2 Step 4 |
| Per-customer: email, # games, avg teams, completion rate, last active | Task 1 + Task 2 |
| Completion rate color coding (≥80% green, 50-79% yellow, <50% red) | Task 2 Step 4 `rateColor()` |
| Click customer → expand to show individual games | Task 2 Step 4 `expandedCustomer` state |
| Individual game: name, team count, top score, finished status | Task 1 + Task 2 |
| Mission rankings sorted by # games descending | Task 1 (sort in API) |
| Mission: name, game count, completion%, progress bar | Task 2 Step 4 |
| Completion% = teams completing / teams in games including mission | Task 1 `missionStatsMap` computation |
| Read-only (no actions) | Both tasks — no action buttons |
| Superadmin-only | Task 1 `if (!admin?.isSuperAdmin)` |

All requirements covered. No placeholders found.

**Type consistency check:** `AnalyticsGame`, `AnalyticsCustomer`, `AnalyticsMissionStat`, `AnalyticsKPIs`, `AnalyticsData` types are defined in Task 2 Step 1 and used consistently in Step 4. The API route uses the same field names.
