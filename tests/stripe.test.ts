import { describe, it, expect } from 'vitest';
import { planFromPriceId, PLANS } from '@/lib/stripe';

// Price ids are injected via vitest.config.ts test.env.
describe('planFromPriceId', () => {
  it('maps the Pro price id to the pro tier', () => {
    expect(planFromPriceId(PLANS.pro.priceId)).toBe('pro');
    expect(planFromPriceId('price_pro_test')).toBe('pro');
  });

  it('maps the Studio price id to the studio tier', () => {
    expect(planFromPriceId(PLANS.studio.priceId)).toBe('studio');
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
