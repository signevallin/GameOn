# Superadmin Analytics Dashboard Design

## Goal

Give the superadmin a read-only analytics dashboard that shows all customer games, which missions are most played, completion rates, and which games aren't finished — so patterns across all customers can be spotted at a glance.

## Layout

Two-column side-by-side layout inside the existing "Customers" tab (renamed to "Analytics"):

- **Top:** 4 KPI cards spanning full width
- **Left column:** Expandable customer list
- **Right column:** Mission rankings

---

## KPI Cards (top row, 4 cards)

| Card | Primary value | Secondary |
|------|--------------|-----------|
| Totalt spel | Count of all games across all customers | "X avslutade" |
| Aktiva kunder | Count of distinct customers who have ≥1 game | "X aktiva senaste 30d" |
| Spelklar-rate | % of all games that are finished | – |
| Snitt lag/spel | Average team count across all games | "totalt X lag" |

---

## Left Column — Customer List

- Sorted by most recent game activity (last game started_at or updated_at, descending)
- Each row shows: email, # games, avg teams/game, completion rate (color-coded), last active date
- Completion rate color coding: ≥80% green, 50–79% yellow, <50% red
- Click a customer row → expands inline to show that customer's individual games
  - Each game row: game name, team count, top score, finished (✓ or —)
  - Games sorted newest first within the expanded view
- No actions (read-only)

---

## Right Column — Mission Rankings

Header columns: **UPPDRAG / SPEL / KLARADE**

- Each row: mission name, number of distinct games that included this mission, completion % with a color-coded horizontal progress bar
- Sorted by number of games (most played first)
- Completion % formula: `(teams that completed mission) / (total teams in games that included the mission) × 100`
- Color coding same as completion rate: ≥80% green, 50–79% yellow, <50% red

---

## Architecture

### New API route: `app/api/admin/superadmin/analytics/route.ts`

POST endpoint, superadmin-only (same auth as existing `/api/admin/superadmin/users`).

Fetches in parallel:
1. All auth users via `supabase.auth.admin.listUsers()`
2. All games: `id, name, user_id, status, started_at, missions` (missions is a jsonb array of objects with `id`, `name`)
3. All teams: `game_id, score, completed` (array of completed mission IDs), `finished_at`

Computes and returns:
```ts
{
  kpis: {
    totalGames: number,
    finishedGames: number,
    activeCustomers: number,       // distinct user_ids with ≥1 game
    activeCustomers30d: number,    // distinct user_ids with game started in last 30 days
    completionRate: number,        // finishedGames / totalGames
    avgTeamsPerGame: number,
    totalTeams: number,
  },
  customers: Array<{
    id: string,
    email: string,
    gameCount: number,
    avgTeams: number,
    completionRate: number,        // finished games / total games for this customer
    lastActive: string | null,     // most recent game started_at
    games: Array<{
      id: string,
      name: string,
      teamCount: number,
      topScore: number,
      finished: boolean,
      startedAt: string | null,
    }>,
  }>,               // sorted by lastActive desc
  missionStats: Array<{
    id: string,
    name: string,
    gameCount: number,             // distinct games that included this mission
    completedCount: number,        // teams that completed it
    totalTeams: number,            // teams in games that included this mission
    completionRate: number,        // completedCount / totalTeams
  }>,               // sorted by gameCount desc
}
```

### UI changes: `components/screens/AdminScreen.tsx`

- Rename the "Customers" tab button label to "Analytics" (keep `tab === 'customers'` key to avoid refactoring)
- Replace existing customers table with the new two-column analytics layout
- New state:
  - `analytics` — holds the API response
  - `expandedCustomer: string | null` — which customer row is expanded
  - `analyticsLoading: boolean`
- Load analytics data when "Analytics" tab is opened (same pattern as existing `loadCustomers`)
- KPI cards render above the two columns
- Customer list: clicking a row toggles `expandedCustomer`; expanded rows show individual games
- Mission stats: render in right column with progress bars using inline styles

### Existing `/api/admin/superadmin/users` route

No changes needed — it can remain for any other usage. The new analytics route replaces its role for the Analytics tab.

---

## Data Notes

- `missions` on the games table is a jsonb column containing an array of mission objects `{ id, name, icon, ... }`
- `completed` on teams table is a jsonb array of mission ID strings
- `finished_at` on teams table is non-null when a team has finished; a game is "finished" when all teams have a non-null `finished_at` — or use `games.status` field if it exists

---

## Out of Scope

- Time range filtering (all-time only)
- Exporting data
- Any actions (delete, impersonate, etc.)
- Real-time updates
- Pagination (render all; typical superadmin has < 100 customers)
