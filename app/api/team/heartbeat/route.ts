// app/api/team/heartbeat/route.ts
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
  let body: { memberId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { memberId } = body;
  if (!memberId || typeof memberId !== 'string') {
    return NextResponse.json({ error: 'Missing memberId.' }, { status: 400 });
  }

  const { error } = await getSupabase()
    .from('team_members')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
