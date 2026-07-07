# Operations: backups, disaster recovery, staging

The customer-facing promise this protects: a company books an event, players
play, reports exist afterwards. Losing the database mid-event is the worst-case
scenario — everything here is about making that survivable.

## 1. Backups

**Important: Supabase's free tier does NOT take automatic backups.** Until the
project is on Pro (daily backups, 7-day retention) one of these is required:

**Option A — upgrade Supabase to Pro** (recommended once there are paying
customers): automatic daily backups + optional point-in-time recovery (PITR).
Nothing else to do.

**Option B — manual `pg_dump` routine** (free): from any machine with `psql`
installed, using the connection string from Supabase → Project Settings →
Database:

```bash
pg_dump "$DATABASE_URL" \
  --format=custom --no-owner --no-privileges \
  --file="gameon-$(date +%F).dump"
```

Run weekly (calendar reminder or local cron) and keep the last ~8 dumps
somewhere private (not in the git repo — dumps contain player PII).
Photos live in Supabase Storage and are deliberately *not* part of this dump;
they're transient by policy (30-day retention) and acceptable to lose.

## 2. Restore drill (do this once BEFORE you need it)

A backup you've never restored is a hope, not a backup.

1. Create a scratch Supabase project (or use the local CLI stack).
2. `pg_restore --dbname="$SCRATCH_DATABASE_URL" --no-owner gameon-YYYY-MM-DD.dump`
3. Point a local `npm run dev` at the scratch project and confirm you can log
   in and see games.
4. Delete the scratch project.

Time it. That number is your realistic recovery time if production dies.

## 3. Disaster recovery quick reference

| Scenario | Action |
|---|---|
| Bad deploy (app broken, data fine) | Vercel → Deployments → Promote the previous deployment. Instant. |
| Bad migration / data corruption | Restore latest backup into a fresh Supabase project, update the four `SUPABASE_*` env vars in Vercel, redeploy. |
| Supabase region outage | Wait it out (status.supabase.com) — or restore the backup into a project in another region if it's prolonged. |
| Leaked service-role key | Supabase → Settings → API → rotate the key, update Vercel env, redeploy. Then check `stripe_events`/logs for abuse. |
| Stripe webhook signing secret leaked | Stripe → Webhooks → roll secret, update `STRIPE_WEBHOOK_SECRET`. |

Keep a copy of all production env var names + where their values live (Stripe
dashboard, Supabase dashboard, Upstash, Resend) — recovery is mostly re-wiring
these five services together.

## 4. Staging

Never test migrations or risky features against production. The cheap setup:

- **App:** every Vercel preview deployment (any non-main branch push) is already
  a staging app. Point previews at the staging database by setting the
  `SUPABASE_*` env vars for the "Preview" environment in Vercel to the staging
  project's values (Vercel scopes env vars per environment).
- **Database:** a free Supabase project provisioned with
  `supabase/test-bootstrap.sql` (same file the E2E suite uses — one paste in the
  SQL editor). Re-run the file any time to reset it.
- **Flow:** migrations get applied to staging first (SQL editor or
  `supabase db push`), the preview deployment is clicked through, then the same
  migration goes to production together with the merge to main.

## 5. Rate limiting backend (Upstash)

`lib/rate-limit.ts` uses Upstash Redis for a strict global limit when
`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set (create a free
Redis database at console.upstash.com → copy the REST URL + token). Without
them it falls back to a per-instance in-memory limiter — fine for launch, but
serverless instances don't share counters, so set up Upstash before any traffic
spike you care about. Redis errors fail open (requests allowed) by design.
