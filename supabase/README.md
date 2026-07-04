# Database (Supabase / Postgres)

This directory is the single source of truth for the GameOn schema. To stand up
a **fresh** project, apply the migrations in `migrations/` in filename order
(they are timestamp-prefixed). With the Supabase CLI:

```bash
supabase db push          # applies everything in migrations/ in order
```

All migrations are written to be idempotent (`IF NOT EXISTS` / `DROP POLICY IF
EXISTS`), so re-running them against an existing project is safe.

## Security model

- **Row Level Security is enabled and deny-by-default on every table**
  (`20260704_rls_hardening.sql`). The public `anon` key that ships in the
  browser cannot read or write game data directly.
- All game data is reached through the server API routes in `app/api/**`, which
  use the `SUPABASE_SERVICE_ROLE_KEY` (service role bypasses RLS). Those routes
  enforce authentication and per-owner authorization in application code — RLS
  is the defence-in-depth backstop.
- `games`, `custom_missions`, `custom_mission_categories`, `admin_branding`,
  `game_templates`, and `subscriptions` additionally grant the signed-in owner
  access to their own rows (`user_id = auth.uid()`), so a future direct-from-
  client feature stays isolated per customer.

## History

The files under `../docs/sql/` were one-off scripts pasted into the Supabase SQL
editor before the schema was tracked here. They are now superseded by the
tracked migrations (`20260528000000_baseline_untracked_tables.sql` and
`20260704_rls_hardening.sql`) and kept only for historical reference.
