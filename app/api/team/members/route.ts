// app/api/team/members/route.ts
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
  let body: { teamId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { teamId } = body;
  if (!teamId || typeof teamId !== 'string') {
    return NextResponse.json({ error: 'teamId required.' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('team_members')
    .select('id, name')
    .eq('team_id', teamId)
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ members: data ?? [] });
}
