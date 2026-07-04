-- 20260704000002_stripe_events.sql
-- Idempotency ledger for Stripe webhooks. Stripe delivers events at-least-once,
-- so we record each processed event id and skip anything we've already handled
-- (prevents duplicate welcome/cancellation emails on retries).

CREATE TABLE IF NOT EXISTS stripe_events (
  id           TEXT PRIMARY KEY,          -- Stripe event id (evt_...)
  type         TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) ever touches this.
