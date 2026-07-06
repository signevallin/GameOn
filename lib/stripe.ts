import Stripe from 'stripe';

// Fallback ensures Stripe can be imported at build-time without a real key.
// All actual API calls happen at runtime where the real key is injected.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder_build_only', {
  apiVersion: '2026-05-27.dahlia',
});

export type BillingInterval = 'monthly' | 'yearly';

// Each plan has a monthly and a yearly price. Yearly falls back to the original
// single-price env vars so existing configuration keeps working.
export const PLANS = {
  pro: {
    name: 'Pro',
    prices: {
      monthly: { priceId: process.env.STRIPE_PRO_PRICE_ID_MONTHLY ?? '', amount: 19900 },   // 199 kr
      yearly:  { priceId: process.env.STRIPE_PRO_PRICE_ID_YEARLY ?? process.env.STRIPE_PRO_PRICE_ID ?? '', amount: 149000 }, // 1490 kr
    },
  },
  studio: {
    name: 'Studio',
    prices: {
      monthly: { priceId: process.env.STRIPE_STUDIO_PRICE_ID_MONTHLY ?? '', amount: 39000 }, // 390 kr
      yearly:  { priceId: process.env.STRIPE_STUDIO_PRICE_ID_YEARLY ?? process.env.STRIPE_STUDIO_PRICE_ID ?? '', amount: 349000 }, // 3490 kr
    },
  },
} as const;

export type Plan = keyof typeof PLANS;

export function isBillingInterval(v: unknown): v is BillingInterval {
  return v === 'monthly' || v === 'yearly';
}

/** The Stripe price id for a plan + interval (empty string if not configured). */
export function priceIdFor(plan: Plan, interval: BillingInterval): string {
  return PLANS[plan].prices[interval].priceId;
}

/**
 * Resolves a Stripe price id back to a plan tier, across both intervals. Used by
 * the webhook to keep the stored plan in sync when a customer changes plan (or
 * switches monthly/yearly) via the billing portal. Returns null for an
 * unrecognised price.
 */
export function planFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  for (const [tier, cfg] of Object.entries(PLANS)) {
    for (const p of Object.values(cfg.prices)) {
      if (p.priceId && p.priceId === priceId) return tier as Plan;
    }
  }
  return null;
}
