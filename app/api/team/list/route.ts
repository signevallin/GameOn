import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { gameId } = await req.json();
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, score, active_effects')
    .eq('game_id', gameId)
    .order('score', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ teams });
}
