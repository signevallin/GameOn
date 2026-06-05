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
