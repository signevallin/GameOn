-- Subscriptions table
-- Tracks Stripe subscription state per user.
-- One row per user (upserted on conflict with user_id).

create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users(id) on delete cascade,
  stripe_customer_id     text not null,
  stripe_subscription_id text not null,
  plan                   text not null check (plan in ('free', 'pro', 'studio')),
  status                 text not null check (status in ('active', 'canceled', 'past_due', 'trialing')),
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint subscriptions_user_id_key            unique (user_id),
  constraint subscriptions_stripe_customer_id_key  unique (stripe_customer_id),
  constraint subscriptions_stripe_subscription_id_key unique (stripe_subscription_id)
);

-- Index for fast lookups by Stripe customer (used when syncing webhooks)
create index if not exists subscriptions_stripe_customer_id_idx
  on public.subscriptions (stripe_customer_id);

-- Row-level security: users can read their own subscription; writes via service role only
alter table public.subscriptions enable row level security;

create policy "Users can read their own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

-- Service role key bypasses RLS automatically — no insert/update policy needed for webhooks
