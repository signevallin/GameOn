// app/api/admin/played-missions/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { data, error } = await getSupabase()
    .from('games')
    .select('missions')
    .eq('user_id', admin.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const set = new Set<string>();
  for (const row of data ?? []) {
    const missions = (row as { missions: unknown }).missions;
    if (Array.isArray(missions)) {
      for (const id of missions) {
        if (typeof id === 'string' && id.length > 0) set.add(id);
      }
    }
  }

  return NextResponse.json({ playedIds: Array.from(set) });
}
