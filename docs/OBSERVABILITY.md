# Observability

Production monitoring for GameOn, in two parts: **is it up?** and **did
something break?**

## Uptime — `/api/health`

`GET /api/health` is an unauthenticated probe that checks the app can reach its
database:

- `200 {"status":"ok","db":"ok",...}` — healthy
- `503 {"status":"degraded","db":"error",...}` — the database is unreachable

Point an uptime monitor at `https://playgameon.app/api/health` and alert on any
non-200. Free options: UptimeRobot, Better Stack, or Vercel's own monitors.
Suggested interval: 1–5 minutes.

## Errors — capture + alerts

Errors flow through `lib/observability.ts`:

- Server route errors — wrap a handler in `withErrorCapture('/api/route', handler)`,
  or call `captureError(err, { route })` in a catch block (the Stripe webhook
  already does this).
- Client render errors — the `app/error.tsx` and `app/global-error.tsx`
  boundaries POST to `/api/client-error`, which funnels them into the same pipeline.

Every captured error is written as a structured `[capture]` log line (searchable
in Vercel logs / any log drain). If **`ERROR_WEBHOOK_URL`** is set to a Slack or
Discord incoming-webhook URL, a one-line alert is also sent there.

## Upgrading to Sentry

When you want full stack traces, breadcrumbs and release tracking, install
`@sentry/nextjs` and call `Sentry.captureException(err)` inside `captureError` —
every existing call site keeps working, so it's a one-file change.
