import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET – kept for browser debug visits
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key')?.toUpperCase();
  if (!key) return NextResponse.json({ error: 'Missing game key.' }, { status: 400 });

  const { data, error } = await getSupabase()
    .from('games').select('*').eq('game_key', key).single();

  if (error || !data) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
  return NextResponse.json({ game: data }, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } });
}

// POST – used by client polling (POST is never cached by Vercel edge)
export async function POST(req: Request) {
  const { key } = await req.json();
  if (!key) return NextResponse.json({ error: 'Missing game key.' }, { status: 400 });

  const { data, error } = await getSupabase()
    .from('games').select('*').eq('game_key', key.toUpperCase()).single();

  if (error || !data) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
  return NextResponse.json({ game: data });
}
