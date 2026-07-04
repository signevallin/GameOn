import { describe, it, expect } from 'vitest';
import { effectivePlan, LIMITS, type Subscription } from '@/lib/subscription';

function sub(partial: Partial<Subscription>): Subscription {
  return {
    plan: 'pro',
    status: 'active',
    current_period_end: null,
    stripe_customer_id: 'cus_1',
    ...partial,
  };
}

const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
const past = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

describe('effectivePlan', () => {
  it('grants the paid plan while active with a future period end', () => {
    expect(effectivePlan(sub({ plan: 'pro', status: 'active', current_period_end: future }))).toBe('pro');
  });

  it('grants the paid plan while active with no period end', () => {
    expect(effectivePlan(sub({ plan: 'studio', status: 'active', current_period_end: null }))).toBe('studio');
  });

  it('grants the paid plan while trialing', () => {
    expect(effectivePlan(sub({ plan: 'studio', status: 'trialing', current_period_end: future }))).toBe('studio');
  });

  it('downgrades a past_due subscription to free (lapsed payment)', () => {
    expect(effectivePlan(sub({ plan: 'pro', status: 'past_due', current_period_end: future }))).toBe('free');
  });

  it('downgrades a canceled subscription to free', () => {
    expect(effectivePlan(sub({ plan: 'pro', status: 'canceled', current_period_end: future }))).toBe('free');
  });

  it('downgrades to free once the paid period has expired even if still marked active', () => {
    expect(effectivePlan(sub({ plan: 'pro', status: 'active', current_period_end: past }))).toBe('free');
  });

  it('leaves a free plan as free', () => {
    expect(effectivePlan(sub({ plan: 'free', status: 'active' }))).toBe('free');
  });
});

describe('LIMITS', () => {
  it('gates paid features on the free tier', () => {
    expect(LIMITS.free.customMissions).toBe(false);
    expect(LIMITS.free.powerups).toBe(false);
    expect(LIMITS.free.pdfReports).toBe(false);
    expect(LIMITS.free.maxTeams).toBe(5);
  });

  it('unlocks paid features on pro and studio', () => {
    for (const tier of ['pro', 'studio'] as const) {
      expect(LIMITS[tier].customMissions).toBe(true);
      expect(LIMITS[tier].powerups).toBe(true);
      expect(LIMITS[tier].pdfReports).toBe(true);
      expect(LIMITS[tier].maxTeams).toBe(Infinity);
    }
  });
});
