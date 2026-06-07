import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: Request,
  { params }: { params: { gameKey: string } }
) {
  const supabase = getSupabase();
  const gameKey = params.gameKey.toUpperCase();

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('id, name, status, started_at, duration_minutes')
    .eq('game_key', gameKey)
    .single();

  if (gameErr || !game) {
    return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
  }

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, score, pending_notification')
    .eq('game_id', game.id)
    .order('score', { ascending: false });

  const teamIds = (teams ?? []).map((t: { id: string }) => t.id);

  const { data: photos } = await supabase
    .from('photo_submissions')
    .select('id, photo_url, team_id, created_at')
    .eq('status', 'rated')
    .in('team_id', teamIds.length > 0 ? teamIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json(
    {
      game: {
        name: game.name,
        status: game.status,
        started_at: game.started_at,
        duration_minutes: game.duration_minutes,
      },
      teams: teams ?? [],
      photos: photos ?? [],
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  );
}
