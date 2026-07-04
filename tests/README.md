# Tests

Unit tests run with [Vitest](https://vitest.dev).

```bash
npm test          # run once (used in CI)
npm run test:watch
```

## Scope

These cover the highest-risk pure and dependency-injectable logic — the code
where a regression means lost revenue or a security hole:

- **`auth-server.test.ts`** — the cross-tenant ownership guards
  (`requireGameOwnership` / `requireTeamOwnership`). The helpers take the DB
  client as an argument, so they're tested with a small fake query builder.
- **`subscription.test.ts`** — `effectivePlan` (past_due / expired → free) and
  the `LIMITS` entitlement table.
- **`stripe.test.ts`** — `planFromPriceId` price→tier mapping used by the webhook.
- **`rate-limit.test.ts`** — the fixed-window limiter and IP parsing.
- **`fuzzy-match.test.ts`**, **`template-utils.test.ts`** — answer matching and
  seasonal-template windows.

## Extending

For the API routes themselves (checkout, webhook side effects, game lifecycle),
add integration tests against a disposable Supabase instance (e.g. the Supabase
CLI local stack) rather than mocking the whole client — keep those in a
separate `tests/integration/` directory so the fast unit run stays fast.
