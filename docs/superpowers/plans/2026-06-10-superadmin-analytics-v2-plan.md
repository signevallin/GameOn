# Super Admin Analytics v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated full-screen analytics page for super admins with two tabs — Kunder (customers) and Uppdrag (missions) — accessible from the admin games-list header.

**Architecture:** Extend the existing `POST /api/admin/superadmin/analytics` route to return `gamesPerWeek`, per-customer `plan`, and `planCounts`. Add a new `view === 'analytics'` block in `AdminScreen.tsx` with its own `analyticsTab` state, tab bar, and full two-tab UI — all inline JSX, no new component files.

**Tech Stack:** Next.js App Router, TypeScript, Supabase service-role client, React state, inline SVG-free CSS bar chart (flexbox divs), existing CSS variables.

---

### Task 1: Extend analytics API — gamesPerWeek, plan, planCounts

**Files:**
- Modify: `app/api/admin/superadmin/analytics/route.ts`

- [ ] **Step 1: Add new fields to the response interfaces**

Replace the existing `AnalyticsCustomer` and `AnalyticsResponse` interfaces (lines 25–58) with:

```typescript
export interface AnalyticsCustomer {
  id: string;
  email: string;
  gameCount: number;
  avgTeams: number;
  completionRate: number;
  lastActive: string | null;
  plan: 'free' | 'pro' | 'studio';
  games: AnalyticsGame[];
}

export interface AnalyticsResponse {
  kpis: AnalyticsKPIs;
  customers: AnalyticsCustomer[];
  missionStats: AnalyticsMissionStat[];
  gamesPerWeek: Array<{ weekLabel: string; count: number }>;
  planCounts: { free: number; pro: number; studio: number };
}
```

- [ ] **Step 2: Add the ISO week helper function**

Add this function immediately above the `POST` export (after the `adminClient` function, before line 60):

```typescript
function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.valueOf() - yearStart.valueOf()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}
```

- [ ] **Step 3: Compute gamesPerWeek after the existing data is fetched**

Add this block immediately after `const teams = teamsResult.data ?? [];` (after line 90):

```typescript
  // ── Games per week (last 7 ISO weeks) ────────────────────────────────────
  const now = new Date();
  const weekSlots: Array<{ weekLabel: string; year: number; week: number; count: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i * 7));
    const { week, year } = isoWeek(d);
    weekSlots.push({ weekLabel: `V${week}`, year, week, count: 0 });
  }
  for (const g of games) {
    if (!g.started_at) continue;
    const { week, year } = isoWeek(new Date(g.started_at));
    const slot = weekSlots.find(s => s.week === week && s.year === year);
    if (slot) slot.count++;
  }
  const gamesPerWeek = weekSlots.map(({ weekLabel, count }) => ({ weekLabel, count }));
```

- [ ] **Step 4: Fetch subscriptions and add plan to each customer**

After the existing `customers` array is built (after line 177, before the `// ── Mission stats` comment), add:

```typescript
  // ── Subscription plans ────────────────────────────────────────────────────
  const customerIds = customers.map(c => c.id);
  const { data: subsData } = await supabase
    .from('subscriptions')
    .select('user_id, plan, status')
    .in('user_id', customerIds);

  const planByUserId: Record<string, 'free' | 'pro' | 'studio'> = {};
  for (const sub of (subsData ?? [])) {
    if (sub.status !== 'canceled') {
      planByUserId[sub.user_id] = sub.plan as 'free' | 'pro' | 'studio';
    }
  }

  const customersWithPlan: AnalyticsCustomer[] = customers.map(c => ({
    ...c,
    plan: planByUserId[c.id] ?? 'free' as const,
  }));

  const planCounts = { free: 0, pro: 0, studio: 0 };
  for (const c of customersWithPlan) {
    planCounts[c.plan]++;
  }
```

- [ ] **Step 5: Update the final response**

Replace the last two lines of the POST handler (line 206–207):

```typescript
  const response: AnalyticsResponse = { kpis, customers: customersWithPlan, missionStats, gamesPerWeek, planCounts };
  return NextResponse.json(response);
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn
npx tsc --noEmit 2>&1 | grep "analytics/route"
```

Expected: no errors for that file.

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/superadmin/analytics/route.ts
git commit -m "feat(analytics): add gamesPerWeek, plan per customer, planCounts to API"
```

---

### Task 2: Update types + add analyticsTab state in AdminScreen

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

- [ ] **Step 1: Add `'analytics'` to AdminView type**

At line 390, change:

```typescript
type AdminView = 'games' | 'create' | 'dashboard' | 'missions' | 'templates' | 'manage-templates';
```

to:

```typescript
type AdminView = 'games' | 'create' | 'dashboard' | 'missions' | 'templates' | 'manage-templates' | 'analytics';
```

- [ ] **Step 2: Update local analytics types to include the new fields**

At lines 524–528, replace the five type declarations:

```typescript
  // Analytics state
  type AnalyticsGame = { id: string; name: string | null; teamCount: number; topScore: number; finished: boolean; startedAt: string | null };
  type AnalyticsCustomer = { id: string; email: string; gameCount: number; avgTeams: number; completionRate: number; lastActive: string | null; games: AnalyticsGame[] };
  type AnalyticsMissionStat = { id: string; name: string; gameCount: number; completedCount: number; totalTeams: number; completionRate: number };
  type AnalyticsKPIs = { totalGames: number; finishedGames: number; activeCustomers: number; activeCustomers30d: number; completionRate: number; avgTeamsPerGame: number; totalTeams: number };
  type AnalyticsData = { kpis: AnalyticsKPIs; customers: AnalyticsCustomer[]; missionStats: AnalyticsMissionStat[] };
```

with:

```typescript
  // Analytics state
  type AnalyticsGame = { id: string; name: string | null; teamCount: number; topScore: number; finished: boolean; startedAt: string | null };
  type AnalyticsCustomer = { id: string; email: string; gameCount: number; avgTeams: number; completionRate: number; lastActive: string | null; plan: 'free' | 'pro' | 'studio'; games: AnalyticsGame[] };
  type AnalyticsMissionStat = { id: string; name: string; gameCount: number; completedCount: number; totalTeams: number; completionRate: number };
  type AnalyticsKPIs = { totalGames: number; finishedGames: number; activeCustomers: number; activeCustomers30d: number; completionRate: number; avgTeamsPerGame: number; totalTeams: number };
  type AnalyticsData = { kpis: AnalyticsKPIs; customers: AnalyticsCustomer[]; missionStats: AnalyticsMissionStat[]; gamesPerWeek: Array<{ weekLabel: string; count: number }>; planCounts: { free: number; pro: number; studio: number } };
```

- [ ] **Step 3: Add analyticsTab and analyticsError state**

After line 532 (`const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);`), add:

```typescript
  const [analyticsTab, setAnalyticsTab] = useState<'customers' | 'missions'>('customers');
  const [analyticsError, setAnalyticsError] = useState(false);
```

- [ ] **Step 4: Update loadAnalytics to set error state**

Replace the existing `loadAnalytics` function (lines 959–970):

```typescript
  async function loadAnalytics() {
    setAnalyticsLoading(true);
    setAnalyticsError(false);
    try {
      const res = await POST('/api/admin/superadmin/analytics');
      const data = await res.json();
      if (data.kpis) {
        setAnalytics(data);
      } else {
        setAnalyticsError(true);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setAnalyticsError(true);
    } finally {
      setAnalyticsLoading(false);
    }
  }
```

- [ ] **Step 5: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat(analytics): add analyticsTab state, update types for v2 API"
```

---

### Task 3: Navigation wiring — add Analytics button, remove old analytics tab

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

- [ ] **Step 1: Add "📊 Analytics" button in the games-list header**

In the games view header button group (around line 1342–1344), the current super-admin button is:

```typescript
            {isSuperAdmin && (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { loadTemplates(); setView('manage-templates'); }}>⚙️ Templates</button>
            )}
```

Change it to add the Analytics button directly before Templates:

```typescript
            {isSuperAdmin && (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { setView('analytics'); loadAnalytics(); }}>📊 Analytics</button>
            )}
            {isSuperAdmin && (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { loadTemplates(); setView('manage-templates'); }}>⚙️ Templates</button>
            )}
```

- [ ] **Step 2: Remove old analytics tab button from dashboard tab bar**

At line 2894–2896, remove this block entirely:

```typescript
          {isSuperAdmin && (
            <button className={`admin-tab${tab === 'customers' ? ' active' : ''}`} onClick={() => { setTab('customers'); loadAnalytics(); }}>👥 Analytics</button>
          )}
```

- [ ] **Step 3: Remove mobile more-sheet analytics entry**

At lines 3721–3728, remove this block entirely:

```typescript
                {isSuperAdmin && (
                  <button
                    className="mobile-more-sheet-item"
                    onClick={() => { setTab('customers'); loadAnalytics(); setMobileMoreOpen(false); }}
                  >
                    👥 Analytics
                  </button>
                )}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: 0

- [ ] **Step 5: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat(analytics): wire nav button, remove old in-dashboard analytics tab"
```

---

### Task 4: Analytics page shell + Kunder tab

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

This task adds the full `view === 'analytics'` page. Insert it immediately before the `// ── GAMES LIST ──` comment (before line 1313). The entire block goes there.

- [ ] **Step 1: Add the analytics view block**

Insert the following block before `// ── GAMES LIST ──` at line 1313:

```typescript
  // ── ANALYTICS PAGE (super admin only) ──
  if (view === 'analytics' && isSuperAdmin) {

    function timeAgo(iso: string | null): string {
      if (!iso) return '–';
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `${mins}m sedan`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h sedan`;
      return `${Math.floor(hours / 24)}d sedan`;
    }

    function statusDotColor(lastActive: string | null): string {
      if (!lastActive) return '#555';
      const days = (Date.now() - new Date(lastActive).getTime()) / 86400000;
      if (days <= 7) return '#4ade80';
      if (days <= 30) return '#fbbf24';
      return '#555';
    }

    const kpiCardStyle: React.CSSProperties = {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '12px',
      padding: '16px 20px',
      minWidth: 0,
    };

    return (
      <>
        <nav className="nav" style={{ position: 'relative' }}>
          <button
            className="btn btn-ghost"
            style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setView('games')}
          >
            ← Back
          </button>
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', fontWeight: 700, fontSize: '15px', color: 'var(--text)' }}>
            📊 Analytics
          </div>
          <div className="nav-right">
            <button
              className="btn btn-ghost"
              style={{ padding: '6px 12px', fontSize: '12px' }}
              onClick={loadAnalytics}
              disabled={analyticsLoading}
            >
              {analyticsLoading ? '...' : '↻ Uppdatera'}
            </button>
          </div>
        </nav>

        <div className="container fade-in" style={{ paddingTop: '24px', paddingBottom: '48px' }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0' }}>
            {(['customers', 'missions'] as const).map(t => (
              <button
                key={t}
                onClick={() => setAnalyticsTab(t)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '10px 20px',
                  fontSize: '13px',
                  fontWeight: analyticsTab === t ? 700 : 400,
                  color: analyticsTab === t ? 'var(--text)' : 'var(--muted)',
                  borderBottom: analyticsTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: '-1px',
                  transition: 'color 0.15s',
                }}
              >
                {t === 'customers' ? 'Kunder' : 'Uppdrag'}
              </button>
            ))}
          </div>

          {/* Loading */}
          {analyticsLoading && (
            <div className="empty-state">Laddar analytics...</div>
          )}

          {/* Error */}
          {!analyticsLoading && analyticsError && (
            <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <span>Kunde inte ladda analytics.</span>
              <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={loadAnalytics}>↻ Försök igen</button>
            </div>
          )}

          {/* ── KUNDER TAB ── */}
          {analytics && !analyticsLoading && analyticsTab === 'customers' && (() => {
            const { kpis, customers: cx, gamesPerWeek, planCounts } = analytics;
            const totalCustomers = planCounts.free + planCounts.pro + planCounts.studio;
            const proCustomers = planCounts.pro + planCounts.studio;
            const proRatePct = totalCustomers > 0 ? Math.round(proCustomers / totalCustomers * 100) : 0;
            const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
            const gamesThisMonth = cx.reduce((sum, c) => sum + c.games.filter(g => g.startedAt && g.startedAt >= monthStart).length, 0);
            const maxBarCount = Math.max(...gamesPerWeek.map(w => w.count), 1);
            const recentGames = cx
              .flatMap(c => c.games.map(g => ({ ...g, customerEmail: c.email })))
              .sort((a, b) => {
                if (!a.startedAt) return 1;
                if (!b.startedAt) return -1;
                return b.startedAt.localeCompare(a.startedAt);
              })
              .slice(0, 10);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aktiva kunder</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#6ec6f5', lineHeight: 1 }}>{kpis.activeCustomers}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>↑ {kpis.activeCustomers30d} senaste 30d</div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Spel totalt</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{kpis.totalGames}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{gamesThisMonth} den här månaden</div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Slutförandegrad</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent3)', lineHeight: 1 }}>{Math.round(kpis.completionRate * 100)}%</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{kpis.finishedGames} av {kpis.totalGames} klara</div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Snitt lag/spel</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{kpis.avgTeamsPerGame}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{kpis.totalTeams} lag totalt</div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pro-kunder</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>{proCustomers}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{proRatePct}% av alla</div>
                  </div>
                </div>

                {/* Row 1: Activity chart + Customer status list */}
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px' }}>

                  {/* Activity chart */}
                  <div style={{ ...kpiCardStyle, padding: '20px 24px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px', color: 'var(--text)' }}>Aktivitet per vecka</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '80px' }}>
                      {gamesPerWeek.map((w, i) => {
                        const barH = Math.max(4, Math.round((w.count / maxBarCount) * 80));
                        const opacity = 0.22 + (i / 6) * 0.78;
                        return (
                          <div
                            key={w.weekLabel}
                            title={`${w.weekLabel}: ${w.count} spel`}
                            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
                          >
                            <div style={{ width: '100%', height: `${barH}px`, background: '#6ec6f5', opacity, borderRadius: '3px 3px 0 0', transition: 'height 0.2s' }} />
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                      {gamesPerWeek.map(w => (
                        <div key={w.weekLabel} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: 'var(--muted)' }}>{w.weekLabel}</div>
                      ))}
                    </div>
                  </div>

                  {/* Customer status list */}
                  <div style={{ ...kpiCardStyle, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>Kundstatus</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'auto', maxHeight: '180px' }}>
                      {cx.map(c => (
                        <div
                          key={c.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '8px', cursor: 'pointer', background: expandedCustomer === c.id ? 'rgba(255,255,255,0.06)' : 'transparent', transition: 'background 0.15s' }}
                          onClick={() => setExpandedCustomer(expandedCustomer === c.id ? null : c.id)}
                        >
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusDotColor(c.lastActive), flexShrink: 0 }} />
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(110,198,245,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#6ec6f5', flexShrink: 0 }}>
                            {(c.email[0] ?? '?').toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>{c.gameCount} spel</div>
                        </div>
                      ))}
                      {cx.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>Inga kunder</div>}
                    </div>
                    {/* Expanded customer games */}
                    {expandedCustomer && (() => {
                      const customer = cx.find(c => c.id === expandedCustomer);
                      if (!customer) return null;
                      return (
                        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', fontWeight: 600 }}>{customer.email}</div>
                          {customer.games.slice(0, 5).map(g => (
                            <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '12px' }}>
                              <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{g.name ?? '(namnlöst)'}</span>
                              <span style={{ color: 'var(--muted)', flexShrink: 0, marginLeft: '8px' }}>{g.teamCount} lag</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Row 2: Recent games feed + Plan distribution */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>

                  {/* Recent games feed */}
                  <div style={{ ...kpiCardStyle, padding: '20px 24px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>Senaste spelen</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                      {recentGames.map(g => {
                        const teamBadgeColor = g.teamCount >= 8 ? 'var(--accent3)' : g.teamCount >= 4 ? '#6ec6f5' : 'var(--muted)';
                        return (
                          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name ?? '(namnlöst)'}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.customerEmail}</div>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>{timeAgo(g.startedAt)}</div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: teamBadgeColor, background: 'rgba(255,255,255,0.06)', borderRadius: '20px', padding: '2px 8px', flexShrink: 0 }}>
                              {g.teamCount} lag
                            </div>
                          </div>
                        );
                      })}
                      {recentGames.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>Inga spel</div>}
                    </div>
                  </div>

                  {/* Plan distribution */}
                  <div style={{ ...kpiCardStyle, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>Planfördelning</div>
                    {totalCustomers > 0 ? (
                      <>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>Pro / Studio</span>
                            <span style={{ color: 'var(--muted)' }}>{proCustomers}</span>
                          </div>
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(proCustomers / totalCustomers) * 100}%`, background: '#f59e0b', borderRadius: '4px', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                            <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Free</span>
                            <span style={{ color: 'var(--muted)' }}>{planCounts.free}</span>
                          </div>
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(planCounts.free / totalCustomers) * 100}%`, background: 'rgba(255,255,255,0.3)', borderRadius: '4px', transition: 'width 0.3s' }} />
                          </div>
                        </div>
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                          <div style={{ fontSize: '22px', fontWeight: 800, color: '#f59e0b' }}>{proRatePct}%</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>pro-rate · {totalCustomers} kunder</div>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: '13px', color: 'var(--muted)', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Inga kunder</div>
                    )}
                  </div>
                </div>

              </div>
            );
          })()}

          {/* ── UPPDRAG TAB — added in Task 5 ── */}
          {analytics && !analyticsLoading && analyticsTab === 'missions' && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '48px 0' }}>Uppdrag-fliken implementeras i nästa steg.</div>
          )}

        </div>
      </>
    );
  }
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: 0

- [ ] **Step 3: Smoke test in browser**

Open the app, log in as superadmin, click "📊 Analytics" in the games list header. You should see the analytics page with the Kunder tab active, loading spinner, then the KPI row and charts once data loads.

- [ ] **Step 4: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat(analytics): add analytics page shell + Kunder tab UI"
```

---

### Task 5: Uppdrag tab

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

This task replaces the placeholder Uppdrag content added in Task 4.

- [ ] **Step 1: Replace the Uppdrag tab placeholder**

Find and replace this exact block (added in Task 4):

```typescript
          {/* ── UPPDRAG TAB — added in Task 5 ── */}
          {analytics && !analyticsLoading && analyticsTab === 'missions' && (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '48px 0' }}>Uppdrag-fliken implementeras i nästa steg.</div>
          )}
```

with:

```typescript
          {/* ── UPPDRAG TAB ── */}
          {analytics && !analyticsLoading && analyticsTab === 'missions' && (() => {
            const { missionStats } = analytics;

            const missionsInUse = missionStats.length;
            const avgCompletion = missionStats.length > 0
              ? missionStats.reduce((s, m) => s + m.completionRate, 0) / missionStats.length
              : 0;
            const mostPopular = missionStats[0] ?? null; // already sorted by gameCount desc
            const hardest = [...missionStats]
              .filter(m => m.gameCount >= 5)
              .sort((a, b) => a.completionRate - b.completionRate)[0] ?? null;

            const top10 = missionStats.slice(0, 10);
            const rarelyUsed = [...missionStats]
              .filter(m => m.gameCount < 5)
              .sort((a, b) => a.gameCount - b.gameCount)
              .slice(0, 5);

            // Per-category stats
            const categoryStats: Record<string, { completionSum: number; count: number }> = {};
            for (const m of missionStats) {
              const cat = MISSION_SUPER_CATEGORY[m.id];
              if (!cat) continue;
              if (!categoryStats[cat]) categoryStats[cat] = { completionSum: 0, count: 0 };
              categoryStats[cat].count++;
              categoryStats[cat].completionSum += m.completionRate;
            }
            const categoryRows = (Object.entries(categoryStats) as [SuperCategoryKey, { completionSum: number; count: number }][])
              .filter(([, s]) => s.count > 0)
              .map(([key, s]) => ({
                key,
                label: SUPER_CATEGORIES[key].label,
                icon: SUPER_CATEGORIES[key].icon,
                color: SUPER_CATEGORIES[key].color,
                avgCompletion: s.completionSum / s.count,
              }))
              .sort((a, b) => b.avgCompletion - a.avgCompletion);

            const missionIconById: Record<string, string> = {};
            for (const m of MISSIONS) missionIconById[m.id] = m.icon;

            const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

            function barColor(rate: number) {
              if (rate >= 0.8) return 'var(--accent3)';
              if (rate >= 0.5) return '#f59e0b';
              return 'var(--accent2)';
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Uppdrag i bruk</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{missionsInUse}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>av {MISSIONS.length} tillgängliga</div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Snitt klarade/spel</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent3)', lineHeight: 1 }}>{Math.round(avgCompletion * 100)}%</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>av valda uppdrag</div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Populärast</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {mostPopular ? `${missionIconById[mostPopular.id] ?? ''} ${mostPopular.name}` : '–'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                      {mostPopular ? `med i ${mostPopular.gameCount} av ${analytics.kpis.totalGames} spel` : ''}
                    </div>
                  </div>
                  <div style={kpiCardStyle}>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Svårast</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent2)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {hardest ? `${missionIconById[hardest.id] ?? ''} ${hardest.name}` : '–'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                      {hardest ? `${Math.round(hardest.completionRate * 100)}% klarar det` : 'Behöver ≥5 spel'}
                    </div>
                  </div>
                </div>

                {/* Row 1: Top missions (3fr) + Right column (2fr) */}
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px' }}>

                  {/* Top missions ranked list */}
                  <div style={{ ...kpiCardStyle, padding: '20px 24px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '16px', color: 'var(--text)' }}>Topp 10 uppdrag</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {top10.map((m, i) => (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 6px', borderRadius: '8px' }}>
                          <div style={{ width: '20px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: rankColors[i] ?? 'var(--muted)', flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '14px' }}>{missionIconById[m.id] ?? '🎯'}</span>
                              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>
                              Med i {m.gameCount} spel · {m.totalTeams} lagförsök
                            </div>
                            <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${m.completionRate * 100}%`, background: barColor(m.completionRate), borderRadius: '2px', transition: 'width 0.3s' }} />
                            </div>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: barColor(m.completionRate), flexShrink: 0, minWidth: '36px', textAlign: 'right' }}>
                            {Math.round(m.completionRate * 100)}%
                          </div>
                        </div>
                      ))}
                      {top10.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', padding: '16px 0' }}>Ingen data</div>}
                    </div>
                  </div>

                  {/* Right column: category breakdown + rarely used */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* Per kategori */}
                    <div style={{ ...kpiCardStyle, padding: '20px 24px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px', color: 'var(--text)' }}>Per kategori</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {categoryRows.map(cat => (
                          <div key={cat.key}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px' }}>{cat.icon}</span>
                              <span style={{ fontSize: '12px', color: 'var(--text)', flex: 1 }}>{cat.label}</span>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: cat.color }}>{Math.round(cat.avgCompletion * 100)}%</span>
                            </div>
                            <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${cat.avgCompletion * 100}%`, background: cat.color, borderRadius: '3px', transition: 'width 0.3s' }} />
                            </div>
                          </div>
                        ))}
                        {categoryRows.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Ingen data</div>}
                      </div>
                    </div>

                    {/* Sällan använda */}
                    <div style={{ ...kpiCardStyle, padding: '20px 24px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: 'var(--text)' }}>Sällan använda</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {rarelyUsed.map(m => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '14px', flexShrink: 0 }}>{missionIconById[m.id] ?? '🎯'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.gameCount} spel · {m.totalTeams} lagförsök</div>
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: barColor(m.completionRate), flexShrink: 0 }}>{Math.round(m.completionRate * 100)}%</div>
                          </div>
                        ))}
                        {rarelyUsed.length === 0 && <div style={{ fontSize: '13px', color: 'var(--muted)' }}>Alla uppdrag används flitigt!</div>}
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            );
          })()}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: 0

- [ ] **Step 3: Smoke test in browser**

Navigate to Analytics, click the "Uppdrag" tab. Verify: KPI row shows 4 cards, top missions list appears with rank numbers, category bars show, and the "Sällan använda" list shows missions with `gameCount < 5`.

- [ ] **Step 4: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat(analytics): add Uppdrag tab with mission rankings and category breakdown"
```

---

### Task 6: Full TypeScript check + push

**Files:**
- No new files

- [ ] **Step 1: Run full TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn
npx tsc --noEmit 2>&1
```

Expected: no output (zero errors).

If errors appear, fix them before proceeding. Common issues:
- `kpiCardStyle` used inside the IIFE in Task 5 but defined outside — it's defined in the `view === 'analytics'` block scope above both tabs, so it should be in scope.
- `timeAgo` and `statusDotColor` defined inside the `view === 'analytics'` block — if TypeScript complains about function declarations inside blocks, convert them to `const` arrow functions.

Fix for function declarations in blocks (if needed):
```typescript
const timeAgo = (iso: string | null): string => { ... };
const statusDotColor = (lastActive: string | null): string => { ... };
```

- [ ] **Step 2: Run build to catch any remaining issues**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` (or similar). Fix any errors that appear.

- [ ] **Step 3: Push to origin**

```bash
git push
```

- [ ] **Step 4: Verify on Vercel**

Check the Vercel deployment logs to confirm no build errors. Navigate to the deployed app, log in as superadmin, and verify the analytics page renders correctly on both tabs.

---

## Spec Self-Review

**Coverage check:**
- ✅ `gamesPerWeek` added to API (Task 1)
- ✅ `plan` per customer from `subscriptions` batch query (Task 1)
- ✅ `planCounts` computed from customer plans (Task 1)
- ✅ `'analytics'` added to `AdminView` type (Task 2)
- ✅ `analyticsTab: 'customers' | 'missions'` state (Task 2)
- ✅ Analytics button in games-list header, super admin only (Task 3)
- ✅ Old analytics tab removed from dashboard (Task 3)
- ✅ Back button → returns to `'games'` view (Task 4)
- ✅ `loadAnalytics()` called on navigation (Task 3)
- ✅ Loading spinner + error state with retry (Task 4)
- ✅ "↻ Uppdatera" button (Task 4)
- ✅ Kunder KPI row: 5 cards (Task 4)
- ✅ Activity chart: 7 bars, opacity gradient (Task 4)
- ✅ Customer status list with status dots (Task 4)
- ✅ Recent games feed (last 10, client-side) (Task 4)
- ✅ Plan distribution bars (Task 4)
- ✅ Uppdrag KPI row: 4 cards (Task 5)
- ✅ Top 10 missions with rank colors + progress bars (Task 5)
- ✅ Per-category completion rates (Task 5)
- ✅ Sällan använda list (Task 5)

**Type consistency check:**
- `AnalyticsData` in AdminScreen mirrors `AnalyticsResponse` in the route — both include `gamesPerWeek` and `planCounts`.
- `AnalyticsCustomer.plan` added in both places.
- `kpiCardStyle` defined in the `view === 'analytics'` block scope — accessible in both IIFE tabs since they're nested inside the same block.
- `timeAgo` and `statusDotColor` defined as function declarations inside the `view === 'analytics'` block — only used in the Kunder tab IIFE which is in the same scope.

**Out-of-scope confirmed excluded:**
- No time range filtering
- No CSV export
- No pagination
- No mobile optimization
- Duration field not shown (not in API)
- Studio visually same as Pro (combined in `proCustomers`)
