# End-to-end tests (Playwright)

```bash
npm run test:e2e          # auth-gate + smoke — no database needed
npm run test:e2e:full     # full run against a seeded TEST Supabase (below)
```

## What runs without setup

`test:e2e` boots a production build with placeholder env and runs:

- **security-gates.spec** — every admin/authenticated API route returns 401
  without a token; player endpoints stay open.
- **smoke.spec** — the landing, privacy and play pages render.

The `cross-tenant` and `game-flow` specs **skip** automatically until you point
them at a test database.

## Running the FULL suite

The full run needs a **non-production** Supabase project (so real customer data
is never touched). Two safe options:

**Option A — Supabase branch (most faithful).** In the Supabase dashboard for the
GameOn project, create a preview/develop branch. It clones the schema via the
project's migrations. Use the branch's URL + keys below.

**Option B — a free throwaway project.** Create a new free Supabase project, then
apply this repo's migrations to it: `supabase link` + `supabase db push` (or run
`supabase/migrations/*.sql` in the SQL editor, in filename order).

Then, one time, export the **test** project's credentials (Dashboard → Project
Settings → API). The service-role key is a secret — only ever use the test
project's, never production's:

```bash
export TEST_SUPABASE_URL="https://<ref>.supabase.co"
export TEST_SUPABASE_ANON_KEY="<anon key>"
export TEST_SUPABASE_SERVICE_ROLE_KEY="<service_role key>"

npm run test:e2e:full
```

`test:e2e:full` will:

1. `scripts/e2e-seed.mjs` — create two confirmed admin users (A, B) and a game
   owned by A, sign them in, and write tokens + the game id to `.env.e2e`
   (gitignored). It refuses to run against the production project ref.
2. Boot the app pointed at the test project and run every spec, now including:
   - **cross-tenant.spec** — admin B gets **403** on admin A's game (teams,
     game/start, powerup); admin A gets 200 on their own.
   - **game-flow.spec** — a player joins, scores a mission, and admin A sees the
     team and score.

## CI

The `e2e` job in `.github/workflows/ci.yml` runs the no-database specs on every
PR. To run the full suite in CI, add `TEST_SUPABASE_URL`,
`TEST_SUPABASE_ANON_KEY` and `TEST_SUPABASE_SERVICE_ROLE_KEY` as repository
secrets and change that job to `npm run test:e2e:full`.
