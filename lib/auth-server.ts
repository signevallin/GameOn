// lib/auth-server.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type AdminUser = {
  userId: string;
  isSuperAdmin: boolean;
};

/**
 * Validates the Bearer token sent by the admin client.
 * Throws an Error if missing or invalid.
 */
export async function validateAdminToken(req: Request): Promise<AdminUser> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Unauthorized');

  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new Error('Unauthorized');

  return {
    userId: user.id,
    isSuperAdmin: user.app_metadata?.role === 'superadmin',
  };
}

/** Returns a 401 JSON response — use when validateAdminToken throws. */
export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized.' }, { status: 401 });
}

/**
 * Verifies that the admin owns the given game (superadmins bypass).
 * Returns an error Response to send back, or null when access is allowed.
 */
export async function requireGameOwnership(
  db: SupabaseClient,
  admin: AdminUser,
  gameId: string
): Promise<Response | null> {
  const { data: game } = await db
    .from('games')
    .select('user_id')
    .eq('id', gameId)
    .single();

  if (!game) return Response.json({ error: 'Game not found.' }, { status: 404 });
  if (!admin.isSuperAdmin && game.user_id !== admin.userId)
    return Response.json({ error: 'Forbidden.' }, { status: 403 });
  return null;
}

/**
 * Verifies that the admin owns the game the given team belongs to.
 * Returns { denied } with an error Response, or { denied: null, gameId }.
 */
export async function requireTeamOwnership(
  db: SupabaseClient,
  admin: AdminUser,
  teamId: string
): Promise<{ denied: Response | null; gameId?: string }> {
  const { data: team } = await db
    .from('teams')
    .select('id, game_id')
    .eq('id', teamId)
    .single();

  if (!team) return { denied: Response.json({ error: 'Team not found.' }, { status: 404 }) };
  if (!team.game_id) {
    // Legacy teams without a game can't be tied to an owner — superadmin only.
    return admin.isSuperAdmin
      ? { denied: null, gameId: undefined }
      : { denied: Response.json({ error: 'Forbidden.' }, { status: 403 }) };
  }

  const denied = await requireGameOwnership(db, admin, team.game_id);
  return { denied, gameId: team.game_id };
}
