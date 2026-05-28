import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Server-side team list cache ───────────────────────────────────────────────
// All 25 teams poll for the same list every 5s — cache it for 4s so the DB
// only gets hit once per cycle instead of 25 times.
const teamListCache = new Map<string, { data: unknown; expiresAt: number }>();

async function getCachedTeams(supabase: ReturnType<typeof getSupabase>, gameId: string) {
  const cached = teamListCache.get(gameId);
  if (cached && Date.now() < cached.expiresAt) return cached.data;

  const { data: teams, error } = await supabase
    .from('teams')
    .select('id, name, score, active_effects, completed, finished_at')
    .eq('game_id', gameId)
    .order('score', { ascending: false });

  if (error) return null;

  teamListCache.set(gameId, { data: teams, expiresAt: Date.now() + 4000 });
  return teams;
}

// ── Combined poll endpoint ────────────────────────────────────────────────────
// Replaces 3 separate API calls (game + team/status + team/list) with one.
// Reduces HTTP connections and DB load significantly at scale.
export async function POST(req: Request) {
  const { teamId, gameId, gameKey } = await req.json();

  if (!teamId || !gameId || !gameKey) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Run game + team queries in parallel, team list from cache
  const [gameRes, teamRes, teams] = await Promise.all([
    supabase.from('games').select('*').eq('game_key', gameKey.toUpperCase()).single(),
    supabase.from('teams').select('*').eq('id', teamId).single(),
    getCachedTeams(supabase, gameId),
  ]);

  if (gameRes.error || !gameRes.data) {
    return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
  }
  if (teamRes.error || !teamRes.data) {
    return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  }

  let game = gameRes.data;

  // Auto-finish if timer has expired
  if (game.status === 'active' && game.started_at) {
    const endTime = new Date(game.started_at).getTime() + game.duration_minutes * 60 * 1000;
    if (Date.now() >= endTime) {
      const { data: finished } = await supabase
        .from('games')
        .update({ status: 'finished' })
        .eq('id', game.id)
        .select()
        .single();
      if (finished) game = finished;
    }
  }

  return NextResponse.json({ game, team: teamRes.data, teams: teams ?? [] });
}
