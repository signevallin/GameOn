# Super Admin Analytics Page – Design Spec (v2)

## Goal

Give the super admin a dedicated, full-screen analytics page with two tabs — one focused on customers and one on missions — accessible from the admin nav header. Replaces the current cramped "Analytics" tab inside the game dashboard.

## Access & Visibility

- Visible **only** when `isSuperAdmin === true`
- Triggered by a new **"📊 Analytics"** button in the admin nav header (games-list view), replacing or alongside existing nav buttons
- New `view` value in `AdminScreen`: `'analytics'`
- Back button → returns to `'games'` view

---

## Navigation

In `AdminScreen`, `view` is a string union. Add `'analytics'` to it. When `view === 'analytics'`, render the full analytics page (no nav tabs, no game context). The analytics page has its own internal tab state (`analyticsTab: 'customers' | 'missions'`).

A button in the games-list header (super admin only):

```
📊 Analytics
```

---

## Data

### Extend existing API: `POST /api/admin/superadmin/analytics`

Add two fields to the response that are not currently returned:

**1. `gamesPerWeek: Array<{ weekLabel: string; count: number }>`**

Last 7 ISO weeks, oldest first. `weekLabel` is `"V{week}"` (e.g. `"V24"`). Count = games with `started_at` in that week. Games with null `started_at` are excluded.

**2. Per-customer `plan: 'free' | 'pro' | 'studio'`**

In the existing `customers` array, add `plan` field. Fetched via a single batch query:

```sql
SELECT user_id, plan FROM subscriptions WHERE user_id = ANY(userIds)
```

Users without a row in `subscriptions` (or with `status = 'canceled'`) default to `'free'`.

**3. `planCounts: { free: number; pro: number; studio: number }`**

Aggregate computed from the per-customer plan data above.

Everything else (kpis, customers, missionStats) is unchanged.

### Type additions

```ts
// In AnalyticsCustomer:
plan: 'free' | 'pro' | 'studio';

// New top-level:
gamesPerWeek: Array<{ weekLabel: string; count: number }>;
planCounts: { free: number; pro: number; studio: number };
```

---

## UI — Kunder tab

### KPI row (5 cards)

| Label | Value | Sub-text |
|-------|-------|----------|
| Aktiva kunder | `kpis.activeCustomers` (blue) | `↑ X senaste 30d` |
| Spel totalt | `kpis.totalGames` | `X den här månaden` |
| Slutförandegrad | `kpis.completionRate` % (green) | `X av Y klara` |
| Snitt lag/spel | `kpis.avgTeamsPerGame` | `X lag totalt` |
| Pro-kunder | `planCounts.pro + planCounts.studio` (gold) | `X% av alla` |

### Row 1: Activity chart (3fr) + Customer status (2fr)

**Activity chart**
- Bar chart, 7 bars = last 7 weeks from `gamesPerWeek`
- Current week bar is full-opacity blue (`#6ec6f5`), older bars progressively more transparent
- X-axis labels: week numbers (`V18`, `V19`, …)
- No y-axis labels — relative height is enough
- Week/month toggle is out of scope (always shows 7 weeks)

**Customer status list**
- Sorted by `lastActive` desc (same as API)
- Each row: status dot + avatar initial + email (truncated) + "X spel"
- Status dot color:
  - 🟢 Active: `lastActive` within 7 days
  - 🟡 At risk: `lastActive` 8–30 days ago
  - ⚫ Inactive: `lastActive` > 30 days ago, or null
- Clicking a customer row opens a detail drawer / expands inline (same pattern as current analytics) showing that customer's game history
- No actions, read-only

### Row 2: Recent games feed (2fr) + Plan distribution (1fr)

**Recent games feed**
- Last 10 games across all customers, sorted by `started_at` desc
- Derived client-side by flattening all `customer.games[]` and sorting
- Each row: game name (or "(namnlöst)"), customer email, mission count, duration (from game data — not in current API, skip duration for now), time ago, team count badge
- Team count badge color: green if ≥ 8 teams, blue if 4–7, muted if < 4

**Plan distribution**
- Two horizontal bars: Pro/Studio and Free, proportional to counts
- Summary numbers below: Pro-rate %, total customers

---

## UI — Uppdrag tab

### KPI row (4 cards)

| Label | Value | Sub-text |
|-------|-------|----------|
| Uppdrag i bruk | distinct mission IDs across all games | `av X tillgängliga` (MISSIONS.length) |
| Snitt klarade/spel | avg of (completed/total) per team across all games (%) | `av valda uppdrag` |
| Populärast | name of mission with highest `gameCount` | `med i X av Y spel` |
| Svårast | name of mission with lowest `completionRate` (min 5 games) | `X% klarar det` |

These four values are computed client-side from the existing `missionStats` array.

### Row 1: Top missions list (3fr) + Right column (2fr)

**Top missions — ranked list**
- Show top 10 missions sorted by `gameCount` desc (most played)
- Each row:
  - Rank number (1st = gold, 2nd = silver, 3rd = bronze color)
  - Mission icon + name (from `MISSIONS` array lookup by id for icon)
  - Sub-text: "Med i X spel · Y lagförsök"
  - Horizontal progress bar (green ≥80%, gold 50–79%, red <50%)
  - Completion % right-aligned

**Right column: two stacked cards**

*Per kategori* — completion rate per `SuperCategoryKey`
- Computed client-side: group `missionStats` by `MISSION_SUPER_CATEGORY[id]`, average their completion rates
- One bar per category with the category's color from `SUPER_CATEGORIES`
- Show only categories that have at least 1 mission in `missionStats`

*Sällan använda* — missions with `gameCount < 5`
- List up to 5 missions, sorted by gameCount asc
- Each row: mission icon + name, "X spel · Y lagförsök", completion %
- This surfaces missions that exist but customers rarely pick

---

## Architecture

### Files to change

| File | Change |
|------|--------|
| `app/api/admin/superadmin/analytics/route.ts` | Add `gamesPerWeek`, `plan` per customer, `planCounts` to response |
| `components/screens/AdminScreen.tsx` | Add `'analytics'` view, analytics page component, nav button |

### New state in AdminScreen

```ts
const [analyticsTab, setAnalyticsTab] = useState<'customers' | 'missions'>('customers');
```

The existing `analytics`, `analyticsLoading` state stays. The existing "Analytics" tab in the dashboard is **removed** — it is replaced by the new dedicated view.

### Component structure inside AdminScreen

The analytics page renders when `view === 'analytics'`. It's a self-contained block inside the existing `AdminScreen` return statement — not a separate component file (consistent with how all other views are handled in this file).

Internal structure:
```
<AnalyticsPage>
  <PageHeader />           — title, back button
  <TabBar />               — Kunder | Uppdrag
  {analyticsTab === 'customers' && <CustomersTab />}
  {analyticsTab === 'missions' && <MissionsTab />}
</AnalyticsPage>
```

These are not separate React components — they are inline JSX blocks, consistent with the rest of AdminScreen.

---

## Loading & Error States

- On first open: `loadAnalytics()` fires, spinner shown
- On error: "Kunde inte ladda analytics." with retry button
- Data is not auto-refreshed — manual "↻ Uppdatera" button re-calls the API

---

## Out of Scope

- Time range filtering
- CSV/PDF export
- Real-time updates / polling
- Any write actions (no deleting customers, no impersonation)
- Pagination (< 100 customers expected)
- Mobile optimization (super admin uses desktop)
- Studio plan visual distinction (treated same as Pro)
