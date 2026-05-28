// app/api/admin/superadmin/users/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin?.isSuperAdmin) return unauthorizedResponse();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: games } = await supabase.from('games').select('user_id');
  const gameCounts = (games ?? []).reduce((acc: Record<string, number>, g) => {
    if (g.user_id) acc[g.user_id] = (acc[g.user_id] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    users: users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      game_count: gameCounts[u.id] ?? 0,
      is_super_admin: u.app_metadata?.role === 'superadmin',
    })),
  });
}
