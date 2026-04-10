import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST – used by admin polling (POST is never cached by Vercel edge)
export async function POST(req: Request) {
  const { gameId } = await req.json();
  let query = getSupabase().from('teams').select('*').order('score', { ascending: false });
  if (gameId) query = query.eq('game_id', gameId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ teams: data });
}

// GET – kept for compatibility
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');
  let query = getSupabase().from('teams').select('*').order('score', { ascending: false });
  if (gameId) query = query.eq('game_id', gameId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ teams: data }, { headers: { 'Cache-Control': 'no-store, no-cache' } });
}
