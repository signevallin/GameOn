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

// GET – list all games (kept for compatibility)
export async function GET() {
  const { data, error } = await adminClient()
    .from('games')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ games: data }, { headers: { 'Cache-Control': 'no-store, no-cache' } });
}

// POST – either list games (action:'list') or create a new game
export async function POST(req: Request) {
  const body = await req.json();

  // action:'list' – fetch all games (POST is never cached by Vercel edge)
  if (body.action === 'list') {
    const { data, error } = await adminClient()
      .from('games')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ games: data });
  }

  // action:'delete' – delete a game and all its teams/photo submissions
  if (body.action === 'delete') {
    const { gameId } = body;
    if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

    // Get team IDs first so we can cascade-delete photo submissions
    const { data: gameTeams } = await adminClient()
      .from('teams').select('id').eq('game_id', gameId);
    const teamIds = (gameTeams ?? []).map((t: { id: string }) => t.id);
    if (teamIds.length) {
      await adminClient().from('photo_submissions').delete().in('team_id', teamIds);
    }
    await adminClient().from('teams').delete().eq('game_id', gameId);
    const { error } = await adminClient().from('games').delete().eq('id', gameId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // default – create a new game
  const { name, missions, duration_minutes } = body;
  if (!missions?.length) {
    return NextResponse.json({ error: 'Select at least one mission.' }, { status: 400 });
  }

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
