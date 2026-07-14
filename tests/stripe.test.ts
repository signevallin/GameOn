import { describe, it, expect } from 'vitest';
import { planFromPriceId, priceIdFor, PLANS } from '@/lib/stripe';

// Price ids are injected via vitest.config.ts test.env.
describe('priceIdFor', () => {
  it('resolves each plan + interval to its price id', () => {
    expect(priceIdFor('pro', 'monthly')).toBe('price_pro_monthly_test');
    expect(priceIdFor('pro', 'yearly')).toBe('price_pro_test');
    expect(priceIdFor('studio', 'monthly')).toBe('price_studio_monthly_test');
    expect(priceIdFor('studio', 'yearly')).toBe('price_studio_test');
  });

  it('exposes the amounts in öre', () => {
    expect(PLANS.pro.prices.monthly.amount).toBe(19900);
    expect(PLANS.pro.prices.yearly.amount).toBe(149000);
    expect(PLANS.studio.prices.monthly.amount).toBe(39000);
    expect(PLANS.studio.prices.yearly.amount).toBe(349000);
  });
});

describe('planFromPriceId', () => {
  it('maps both intervals of Pro to the pro tier', () => {
    expect(planFromPriceId('price_pro_monthly_test')).toBe('pro');
    expect(planFromPriceId('price_pro_test')).toBe('pro');
  });

  it('maps both intervals of Studio to the studio tier', () => {
    expect(planFromPriceId('price_studio_monthly_test')).toBe('studio');
    expect(planFromPriceId('price_studio_test')).toBe('studio');
  });

  it('returns null for an unknown price id', () => {
    expect(planFromPriceId('price_unknown')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(planFromPriceId(null)).toBeNull();
    expect(planFromPriceId(undefined)).toBeNull();
  });
});
