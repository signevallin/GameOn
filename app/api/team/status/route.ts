import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET – kept for compatibility
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  if (!teamId) return NextResponse.json({ error: 'Missing teamId.' }, { status: 400 });

  const { data, error } = await getSupabase()
    .from('teams').select('*').eq('id', teamId).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ team: data }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

// POST – used by client polling (POST is never cached by Vercel edge)
export async function POST(req: Request) {
  const { teamId } = await req.json();
  if (!teamId) return NextResponse.json({ error: 'Missing teamId.' }, { status: 400 });

  const { data, error } = await getSupabase()
    .from('teams').select('*').eq('id', teamId).single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ team: data });
}
