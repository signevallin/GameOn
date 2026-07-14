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

The full run needs a **non-production** Supabase-compatible database. The app's
admin login is built on Supabase Auth (GoTrue) — it issues and verifies the
admin JWTs — so a plain Postgres (Neon, Railway, etc.) will not work; there is
no auth server to mint the tokens. Any of the options below is fine and free.

### Option 0 — Local Supabase (free, no cloud project, recommended)

Runs the whole stack (Postgres + Auth) in Docker via the Supabase CLI. It does
not count against your cloud project quota.

Run the local stack from a **scratch directory**, not the repo — the repo's
migrations are incomplete and would error on an empty database. We set the
schema from the self-contained `supabase/test-bootstrap.sql` instead.

```bash
# 1. Install the CLI once (macOS): brew install supabase/tap/supabase

# 2. Boot a clean local stack from a throwaway dir:
mkdir ~/gameon-e2e-db && cd ~/gameon-e2e-db
supabase init          # accept defaults
supabase start         # requires Docker; prints local URL + keys
supabase status        # note API URL, anon key, service_role key
```

**3. Load the schema.** Open local Studio at http://127.0.0.1:54323 → SQL
Editor → paste the contents of the repo's `supabase/test-bootstrap.sql` → Run.
(Or, if you have `psql`: `psql "<DB URL from status>" -f <repo>/supabase/test-bootstrap.sql`.)

```bash
# 4. Back in the repo, point the tests at the local stack and run:
cd <repo>
export TEST_SUPABASE_URL="http://127.0.0.1:54321"      # API URL from status
export TEST_SUPABASE_ANON_KEY="<anon key from status>"
export TEST_SUPABASE_SERVICE_ROLE_KEY="<service_role key from status>"
npm run test:e2e:full
```

Local keys from `supabase status` are the same fixed demo keys every time and
are safe to use. When done: `cd ~/gameon-e2e-db && supabase stop`.

### Cloud options

If you can't run Docker, use a cloud Supabase project (never production):

**Option A — a free throwaway project (recommended, no cost).** Create a new free
Supabase project, open its SQL editor, and run **`supabase/test-bootstrap.sql`**
once. That single file creates every table the app touches (the tracked
migrations alone are not enough — the base `games`/`teams`/`team_members`
tables were historically created ad-hoc and only exist in production).

**Option B — Supabase branch.** Requires the paid Supabase Pro plan. In the
dashboard for the GameOn project, create a preview branch and use its URL +
keys below. Note branches build from tracked migrations, so you will likely
need to run `supabase/test-bootstrap.sql` on the branch too.

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
