// lib/auth-server.ts
import { createClient } from '@supabase/supabase-js';

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
