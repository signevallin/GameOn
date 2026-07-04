import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireGameOwnership, requireTeamOwnership, type AdminUser } from '@/lib/auth-server';

type Row = Record<string, unknown> | null;

/**
 * Minimal fake of the Supabase query builder for the exact chain these helpers
 * use: db.from(table).select(cols).eq(col, val).single() -> { data }.
 */
function makeDb(resolver: (table: string, filters: Record<string, unknown>) => Row): SupabaseClient {
  const db = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const chain = {
        select() { return chain; },
        eq(col: string, val: unknown) { filters[col] = val; return chain; },
        async single() { return { data: resolver(table, filters) }; },
      };
      return chain;
    },
  };
  return db as unknown as SupabaseClient;
}

const owner: AdminUser = { userId: 'user-1', isSuperAdmin: false };
const superAdmin: AdminUser = { userId: 'admin-x', isSuperAdmin: true };

describe('requireGameOwnership', () => {
  it('allows the owner (returns null)', async () => {
    const db = makeDb((table) => (table === 'games' ? { user_id: 'user-1' } : null));
    expect(await requireGameOwnership(db, owner, 'game-1')).toBeNull();
  });

  it('forbids a different tenant with 403', async () => {
    const db = makeDb(() => ({ user_id: 'someone-else' }));
    const res = await requireGameOwnership(db, owner, 'game-1');
    expect(res?.status).toBe(403);
  });

  it('returns 404 when the game does not exist', async () => {
    const db = makeDb(() => null);
    const res = await requireGameOwnership(db, owner, 'missing');
    expect(res?.status).toBe(404);
  });

  it('lets a superadmin act on any game', async () => {
    const db = makeDb(() => ({ user_id: 'someone-else' }));
    expect(await requireGameOwnership(db, superAdmin, 'game-1')).toBeNull();
  });
});

describe('requireTeamOwnership', () => {
  it('allows a team belonging to the owner and returns its gameId', async () => {
    const db = makeDb((table) => {
      if (table === 'teams') return { id: 'team-1', game_id: 'game-1' };
      if (table === 'games') return { user_id: 'user-1' };
      return null;
    });
    const { denied, gameId } = await requireTeamOwnership(db, owner, 'team-1');
    expect(denied).toBeNull();
    expect(gameId).toBe('game-1');
  });

  it("forbids a team in another tenant's game with 403", async () => {
    const db = makeDb((table) => {
      if (table === 'teams') return { id: 'team-1', game_id: 'game-9' };
      if (table === 'games') return { user_id: 'other-owner' };
      return null;
    });
    const { denied } = await requireTeamOwnership(db, owner, 'team-1');
    expect(denied?.status).toBe(403);
  });

  it('returns 404 for a missing team', async () => {
    const db = makeDb(() => null);
    const { denied } = await requireTeamOwnership(db, owner, 'nope');
    expect(denied?.status).toBe(404);
  });

  it('forbids a legacy team with no game for a normal admin', async () => {
    const db = makeDb((table) => (table === 'teams' ? { id: 't', game_id: null } : null));
    const { denied } = await requireTeamOwnership(db, owner, 't');
    expect(denied?.status).toBe(403);
  });

  it('allows a legacy team with no game for a superadmin', async () => {
    const db = makeDb((table) => (table === 'teams' ? { id: 't', game_id: null } : null));
    const { denied } = await requireTeamOwnership(db, superAdmin, 't');
    expect(denied).toBeNull();
  });
});
