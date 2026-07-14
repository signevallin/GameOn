# Post-launch TODO

The app is deployed and safe to sell. These are the remaining **non-blocking**
hardening steps (steps 7–8 from the launch checklist) — do them when you have
time. None of them stop you taking payments today.

## 1. Uptime monitoring

Create a free monitor (UptimeRobot, Better Stack, or Vercel Monitors) pointed at:

```
GET https://playgameon.app/api/health
```

- Interval: 1–5 minutes
- Alert on: any non-`200` response (the endpoint returns `503` when the database
  is unreachable)

Optional: set `ERROR_WEBHOOK_URL` (Vercel env) to a Slack/Discord incoming
webhook so captured errors also ping you. Without it, errors are still logged.

## 2. Backups — pick one (important)

**Supabase's free tier takes NO automatic backups.** Choose:

- **A (recommended once you have paying customers):** upgrade the Supabase
  project to Pro → automatic daily backups + point-in-time recovery. Done.
- **B (free):** weekly `pg_dump` from your machine (command in
  `docs/OPERATIONS.md`), kept privately (never in git — contains player PII).
  Add a recurring calendar reminder.

Then do the **restore drill once** (section 2 of `docs/OPERATIONS.md`) so you
know it actually works and how long recovery takes.

## 3. Staging (optional but cheap)

Point Vercel **Preview** environment's `SUPABASE_*` env vars at a throwaway
Supabase project (provisioned with `supabase/test-bootstrap.sql`). Every
non-main branch push then becomes a safe staging app. Details in
`docs/OPERATIONS.md` §4.

## 4. Email deliverability — SPF / DKIM / DMARC

So welcome / payment-failed / cancellation emails don't land in spam. Full
step-by-step in `docs/EMAIL.md`. Summary:

- Resend → Domains → verify `playgameon.app`, add the DNS records it shows
  (SPF TXT + DKIM CNAME + MX) at your DNS provider.
- Add a DMARC record: `TXT` on `_dmarc` →
  `v=DMARC1; p=quarantine; rua=mailto:hello@playgameon.app; fo=1`
- Wait for Resend to show **Verified**, then test on mail-tester.com (aim 10/10).

## 5. Set up ESLint (developer experience)

The project has no ESLint config, so `next lint` can't run (it prompts
interactively) — the CI lint step is currently omitted for that reason. To add
it: `npm i -D eslint eslint-config-next`, create `.eslintrc.json` with
`{ "extends": "next/core-web-vitals" }`, fix what it flags, then re-add the
`Lint` step to `.github/workflows/ci.yml`.

## 6. Global rate limiting (Upstash) — optional

`lib/rate-limit.ts` already works with a per-instance in-memory limiter. For a
strict global limit before any real traffic spike, create a free Upstash Redis
DB and set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel. See
`docs/OPERATIONS.md` §5.

---

Reference docs: `docs/OPERATIONS.md` (backups/DR/staging/Upstash),
`docs/EMAIL.md` (DNS), `docs/OBSERVABILITY.md` (health check + error alerts).
