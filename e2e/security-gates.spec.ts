import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * Verifies that every admin/authenticated API route rejects an unauthenticated
 * request with 401 — the exact regression risk from the authorization changes
 * (that a route was left ungated). `admin/photos`, `admin/photos/rate`,
 * `scavenger/submissions` and `scavenger/review` previously returned data or
 * acted without any auth check; they must now 401.
 *
 * The missing-token path in validateAdminToken rejects before any database
 * call, so these run against a placeholder-env server with no real Supabase.
 */

type Route = { method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT'; path: string };

const PROTECTED: Route[] = [
  { method: 'POST', path: '/api/admin/game' },
  { method: 'POST', path: '/api/admin/game/start' },
  { method: 'GET', path: '/api/admin/game/some-id/report' },
  { method: 'PATCH', path: '/api/admin/game/some-id' },
  { method: 'POST', path: '/api/admin/teams' },
  { method: 'GET', path: '/api/admin/teams' },
  { method: 'DELETE', path: '/api/admin/teams' },
  { method: 'POST', path: '/api/admin/powerup' },
  { method: 'POST', path: '/api/admin/powerup/resolve-hot-potato' },
  { method: 'POST', path: '/api/admin/mystery-box' },
  { method: 'POST', path: '/api/admin/photos' },
  { method: 'GET', path: '/api/admin/photos' },
  { method: 'POST', path: '/api/admin/photos/rate' },
  { method: 'POST', path: '/api/admin/custom-missions' },
  { method: 'GET', path: '/api/admin/custom-missions' },
  { method: 'POST', path: '/api/admin/mission-categories' },
  { method: 'GET', path: '/api/admin/branding' },
  { method: 'PUT', path: '/api/admin/branding' },
  { method: 'POST', path: '/api/admin/templates/generate' },
  { method: 'POST', path: '/api/admin/templates/describe' },
  { method: 'POST', path: '/api/admin/ai-generate-game' },
  { method: 'POST', path: '/api/admin/ai-generate-mission' },
  { method: 'POST', path: '/api/admin/subscription' },
  { method: 'POST', path: '/api/admin/portal' },
  { method: 'POST', path: '/api/admin/superadmin/analytics' },
  { method: 'POST', path: '/api/admin/superadmin/users' },
  { method: 'POST', path: '/api/scavenger/submissions' },
  { method: 'POST', path: '/api/scavenger/review' },
  { method: 'POST', path: '/api/settings' },
];

async function call(request: APIRequestContext, r: Route) {
  const opts = { data: r.method === 'GET' ? undefined : {} };
  switch (r.method) {
    case 'GET': return request.get(r.path);
    case 'POST': return request.post(r.path, opts);
    case 'DELETE': return request.delete(r.path, opts);
    case 'PATCH': return request.patch(r.path, opts);
    case 'PUT': return request.put(r.path, opts);
  }
}

test.describe('admin API auth gate', () => {
  for (const r of PROTECTED) {
    test(`${r.method} ${r.path} → 401 without a token`, async ({ request }) => {
      const res = await call(request, r);
      expect(res.status()).toBe(401);
    });
  }
});

test.describe('health check', () => {
  test('GET /api/health returns a valid health payload', async ({ request }) => {
    const res = await request.get('/api/health');
    // 200 when the DB is reachable, 503 when not (placeholder env) — both valid.
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(['ok', 'degraded']).toContain(body.status);
    expect(['ok', 'error']).toContain(body.db);
  });
});

test.describe('player endpoints stay open by design', () => {
  // These authenticate by possession of a teamId in the body, not a bearer
  // token, so they must NOT 401 on an anonymous request (they 400 on a bad
  // body instead). This guards against accidentally over-locking them.
  for (const path of ['/api/scavenger/submit', '/api/scavenger/team', '/api/team/login']) {
    test(`POST ${path} is not auth-gated`, async ({ request }) => {
      const res = await request.post(path, { data: {} });
      expect(res.status()).not.toBe(401);
    });
  }
});
