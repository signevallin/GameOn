import Stripe from 'stripe';

// Fallback ensures Stripe can be imported at build-time without a real key.
// All actual API calls happen at runtime where the real key is injected.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_placeholder_build_only', {
  apiVersion: '2026-05-27.dahlia',
});

export const PLANS = {
  pro: {
    name: 'Pro',
    priceId: process.env.STRIPE_PRO_PRICE_ID!,
    amount: 149000, // 1490 SEK in öre
  },
  studio: {
    name: 'Studio',
    priceId: process.env.STRIPE_STUDIO_PRICE_ID!,
    amount: 349000, // 3490 SEK in öre
  },
} as const;

export type Plan = keyof typeof PLANS;

/**
 * Resolves a Stripe price id back to a plan tier. Used by the webhook to keep
 * the stored plan in sync when a customer changes plans via the billing portal
 * (where the subscription metadata still holds the original checkout plan).
 * Returns null for an unrecognised price.
 */
export function planFromPriceId(priceId: string | null | undefined): Plan | null {
  if (!priceId) return null;
  for (const [tier, cfg] of Object.entries(PLANS)) {
    if (cfg.priceId === priceId) return tier as Plan;
  }
  return null;
}
