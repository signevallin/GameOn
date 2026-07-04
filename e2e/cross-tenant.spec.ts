import { test, expect } from '@playwright/test';

/**
 * Verifies the cross-tenant authorization fix end-to-end against real accounts.
 * This one needs a NON-production (test/staging) Supabase and two admin tokens,
 * so it is skipped unless the env vars are provided — it must never run against
 * live customer data.
 *
 * Provide, from a disposable environment:
 *   E2E_BASE_URL         URL of the running app pointed at the test Supabase
 *   E2E_TOKEN_A          bearer token for admin A (owns E2E_GAME_A_ID)
 *   E2E_TOKEN_B          bearer token for admin B (does NOT own game A)
 *   E2E_GAME_A_ID        a game id owned by admin A
 *
 * Then: npx playwright test e2e/cross-tenant.spec.ts
 */

const { E2E_TOKEN_A, E2E_TOKEN_B, E2E_GAME_A_ID } = process.env;
const configured = Boolean(E2E_TOKEN_A && E2E_TOKEN_B && E2E_GAME_A_ID);

test.describe('cross-tenant isolation', () => {
  test.skip(!configured, 'Set E2E_TOKEN_A/B + E2E_GAME_A_ID against a test Supabase to run.');

  test('owner can read their own game teams', async ({ request }) => {
    const res = await request.post('/api/admin/teams', {
      headers: { Authorization: `Bearer ${E2E_TOKEN_A}` },
      data: { gameId: E2E_GAME_A_ID },
    });
    expect(res.status()).toBe(200);
  });

  test('a different admin cannot read another tenant\'s teams', async ({ request }) => {
    const res = await request.post('/api/admin/teams', {
      headers: { Authorization: `Bearer ${E2E_TOKEN_B}` },
      data: { gameId: E2E_GAME_A_ID },
    });
    expect(res.status()).toBe(403);
  });

  test('a different admin cannot start another tenant\'s game', async ({ request }) => {
    const res = await request.post('/api/admin/game/start', {
      headers: { Authorization: `Bearer ${E2E_TOKEN_B}` },
      data: { gameId: E2E_GAME_A_ID, action: 'start' },
    });
    expect(res.status()).toBe(403);
  });

  test('a different admin cannot fire power-ups on another tenant\'s game', async ({ request }) => {
    const res = await request.post('/api/admin/powerup', {
      headers: { Authorization: `Bearer ${E2E_TOKEN_B}` },
      data: { type: 'double_points', targetTeamId: 'all', gameId: E2E_GAME_A_ID },
    });
    expect(res.status()).toBe(403);
  });
});
