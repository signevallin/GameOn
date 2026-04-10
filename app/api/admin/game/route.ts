import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function generateKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';
  for (let i = 0; i < 6; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET – list all games
export async function GET() {
  const { data, error } = await adminClient()
    .from('games')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ games: data });
}

// POST – create a new game
export async function POST(req: Request) {
  const { name, missions, duration_minutes } = await req.json();

  if (!missions?.length) {
    return NextResponse.json({ error: 'Select at least one mission.' }, { status: 400 });
  }

  // Generate unique key
  let game_key = generateKey();
  let attempts = 0;
  while (attempts < 10) {
    const { data } = await adminClient().from('games').select('id').eq('game_key', game_key).single();
    if (!data) break;
    game_key = generateKey();
    attempts++;
  }

  const { data, error } = await adminClient()
    .from('games')
    .insert({ name: name || `Game ${game_key}`, missions, duration_minutes: duration_minutes || 45, game_key })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ game: data });
}
