import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { name, gameKey } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: 'Enter a team name.' }, { status: 400 });
  if (!gameKey?.trim()) return NextResponse.json({ error: 'Enter a game key.' }, { status: 400 });

  // Find game
  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('*')
    .eq('game_key', gameKey.toUpperCase())
    .single();

  if (gameErr || !game) return NextResponse.json({ error: 'Wrong game key. Ask the organiser.' }, { status: 404 });
  if (game.status === 'finished') return NextResponse.json({ error: 'This game is already finished.' }, { status: 400 });

  // Upsert team in this game
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .upsert({ name: name.trim(), game_id: game.id, score: 0, completed: [] }, { onConflict: 'name,game_id', ignoreDuplicates: false })
    .select()
    .single();

  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });

  return NextResponse.json({ team, game });
}
