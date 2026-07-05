import { test, expect } from '@playwright/test';

/**
 * Full gameplay loop against a seeded test project: a player joins the game,
 * scores a mission, and the owning admin sees the team and its score. Proves
 * the admin auth + player flow + scoring path still works after the
 * authorization changes.
 *
 * Skipped unless the seed has produced tokens (see scripts/e2e-seed.mjs and
 * npm run test:e2e:full). Never runs against production.
 */

const { E2E_TOKEN_A, E2E_GAME_A_ID, E2E_GAME_KEY } = process.env;
const configured = Boolean(E2E_TOKEN_A && E2E_GAME_A_ID && E2E_GAME_KEY);

test.describe('game flow', () => {
  test.skip(!configured, 'Run via npm run test:e2e:full against a seeded test Supabase.');

  test('player joins, scores, and the owner sees the team', async ({ request }) => {
    const teamName = `Alpha ${Date.now()}`;

    // 1. Player joins the game by name (classic mode).
    const join = await request.post('/api/team/login', {
      data: { name: teamName, gameKey: E2E_GAME_KEY },
    });
    expect(join.status(), await join.text()).toBe(200);
    const { team } = await join.json();
    expect(team?.id).toBeTruthy();

    // 2. Player scores a mission.
    const score = await request.post('/api/team/score', {
      data: { teamId: team.id, missionId: 'e2e_mission', points: 300 },
    });
    expect(score.status(), await score.text()).toBe(200);

    // 3. The owning admin sees the team with its score.
    const teams = await request.post('/api/admin/teams', {
      headers: { Authorization: `Bearer ${E2E_TOKEN_A}` },
      data: { gameId: E2E_GAME_A_ID },
    });
    expect(teams.status()).toBe(200);
    const body = await teams.json();
    const found = (body.teams ?? []).find((t: { name: string }) => t.name === teamName);
    expect(found, 'joined team should appear in the admin roster').toBeTruthy();
    expect(found.score).toBeGreaterThanOrEqual(300);
  });
});
