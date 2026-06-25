// app/api/team/navigate/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  let body: { teamId?: unknown; missionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { teamId, missionId } = body;
  if (!teamId || typeof teamId !== 'string') {
    return NextResponse.json({ error: 'Missing teamId.' }, { status: 400 });
  }
  if (missionId !== null && missionId !== undefined && typeof missionId !== 'string') {
    return NextResponse.json({ error: 'missionId must be a string or null.' }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from('teams')
    .update({ synced_mission_id: (missionId as string | null) ?? null })
    .eq('id', teamId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
