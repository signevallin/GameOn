import { describe, it, expect, vi } from 'vitest';
import type Stripe from 'stripe';
import { applyStripeEvent, resolvePlan, getPeriodEnd, type WebhookDeps } from '@/lib/stripe-webhook';

// Price ids come from vitest.config.ts test.env:
//   price_pro_monthly_test -> pro, price_studio_test -> studio (yearly)

function makeDeps(overrides: Partial<WebhookDeps> = {}): {
  deps: WebhookDeps;
  upsert: ReturnType<typeof vi.fn>;
  sendEmail: ReturnType<typeof vi.fn>;
  getUserEmail: ReturnType<typeof vi.fn>;
} {
  const upsert = vi.fn().mockResolvedValue(undefined);
  const sendEmail = vi.fn().mockResolvedValue(undefined);
  const getUserEmail = vi.fn().mockResolvedValue('owner@example.com');
  const retrieveSubscription = vi.fn().mockResolvedValue(
    subscription({ status: 'active', priceId: 'price_pro_monthly_test' })
  );
  return {
    deps: { upsertSubscription: upsert, sendEmail, getUserEmail, retrieveSubscription, ...overrides },
    upsert,
    sendEmail,
    getUserEmail,
  };
}

function subscription(opts: {
  id?: string;
  status?: string;
  priceId?: string;
  plan?: string;
  userId?: string | null;
  periodEnd?: number;
}): Stripe.Subscription {
  return {
    id: opts.id ?? 'sub_1',
    status: opts.status ?? 'active',
    customer: 'cus_1',
    billing_cycle_anchor: 1_700_000_000,
    metadata: {
      ...(opts.userId === null ? {} : { supabase_user_id: opts.userId ?? 'user_1' }),
      ...(opts.plan ? { plan: opts.plan } : {}),
    },
    items: { data: [{ current_period_end: opts.periodEnd ?? 1_800_000_000, price: { id: opts.priceId } } as never] },
  } as unknown as Stripe.Subscription;
}

function event(type: string, object: unknown): Stripe.Event {
  return { id: `evt_${Math.random()}`, type, data: { object } } as unknown as Stripe.Event;
}

describe('applyStripeEvent — checkout.session.completed', () => {
  const session = {
    mode: 'subscription',
    customer: 'cus_1',
    subscription: 'sub_1',
    metadata: { supabase_user_id: 'user_1', plan: 'pro' },
    customer_details: { email: 'buyer@example.com' },
  };

  it('stores the plan from checkout metadata and sends a welcome email', async () => {
    const { deps, upsert, sendEmail } = makeDeps();
    const res = await applyStripeEvent(event('checkout.session.completed', session), deps);
    expect(res.action).toBe('checkout');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user_1', plan: 'pro', status: 'active', stripeSubscriptionId: 'sub_1',
    }));
    expect(sendEmail).toHaveBeenCalledWith('welcome', 'buyer@example.com', { plan: 'pro' });
  });

  it('ignores non-subscription checkouts', async () => {
    const { deps, upsert } = makeDeps();
    const res = await applyStripeEvent(event('checkout.session.completed', { ...session, mode: 'payment' }), deps);
    expect(res.action).toBe('ignored:not-subscription');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('skips when required metadata is missing', async () => {
    const { deps, upsert } = makeDeps();
    const res = await applyStripeEvent(
      event('checkout.session.completed', { ...session, metadata: { supabase_user_id: 'user_1' } }),
      deps
    );
    expect(res.action).toBe('skipped:missing-metadata');
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('applyStripeEvent — customer.subscription.updated', () => {
  it('derives the plan from the active price (self-serve upgrade/downgrade)', async () => {
    const { deps, upsert } = makeDeps();
    await applyStripeEvent(
      event('customer.subscription.updated', subscription({ status: 'past_due', priceId: 'price_pro_monthly_test', plan: 'studio' })),
      deps
    );
    // Price wins over the stale metadata.plan.
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ plan: 'pro', status: 'past_due' }));
  });

  it('falls back to metadata.plan when the price is unrecognised', async () => {
    const { deps, upsert } = makeDeps();
    await applyStripeEvent(
      event('customer.subscription.updated', subscription({ priceId: 'price_unknown', plan: 'studio' })),
      deps
    );
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ plan: 'studio' }));
  });

  it('skips when the user id is missing', async () => {
    const { deps, upsert } = makeDeps();
    const res = await applyStripeEvent(
      event('customer.subscription.updated', subscription({ userId: null, priceId: 'price_pro_monthly_test' })),
      deps
    );
    expect(res.action).toBe('skipped:missing-metadata');
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('applyStripeEvent — customer.subscription.deleted', () => {
  it('downgrades to free/canceled and emails the owner', async () => {
    const { deps, upsert, sendEmail, getUserEmail } = makeDeps();
    const res = await applyStripeEvent(event('customer.subscription.deleted', subscription({})), deps);
    expect(res.action).toBe('deleted');
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ plan: 'free', status: 'canceled' }));
    expect(getUserEmail).toHaveBeenCalledWith('user_1');
    expect(sendEmail).toHaveBeenCalledWith('cancellation', 'owner@example.com', {});
  });
});

describe('applyStripeEvent — invoice.payment_failed', () => {
  it('sends a dunning email without touching the subscription record', async () => {
    const { deps, upsert, sendEmail } = makeDeps();
    const res = await applyStripeEvent(
      event('invoice.payment_failed', { customer_email: 'late@example.com' }),
      deps
    );
    expect(res.action).toBe('payment_failed');
    expect(sendEmail).toHaveBeenCalledWith('payment_failed', 'late@example.com', {});
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('applyStripeEvent — unknown events', () => {
  it('ignores event types we do not handle', async () => {
    const { deps, upsert } = makeDeps();
    const res = await applyStripeEvent(event('customer.updated', {}), deps);
    expect(res.action).toBe('ignored');
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('resolvePlan prefers the price id over metadata', () => {
    expect(resolvePlan(subscription({ priceId: 'price_studio_test', plan: 'pro' }))).toBe('studio');
  });

  it('getPeriodEnd reads the first item current_period_end (seconds → ms)', () => {
    expect(getPeriodEnd(subscription({ periodEnd: 1_800_000_000 })).getTime()).toBe(1_800_000_000 * 1000);
  });
});
