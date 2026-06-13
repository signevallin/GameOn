import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ONLINE_THRESHOLD_MS } from '@/lib/supabase';

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

// ── Server-side game cache ────────────────────────────────────────────────────
// The game object rarely changes mid-session (only status transitions matter).
// Cache for 4s — same window as the team list — so hundreds of players hitting
// the same game only cost one DB read per 4s instead of one per poll per player.
// When auto-finish fires we write the updated game back into the cache immediately
// so subsequent requests within the same window see the finished state.
const gameCache = new Map<string, { data: unknown; expiresAt: number }>();

async function getCachedGame(supabase: ReturnType<typeof getSupabase>, gameKey: string) {
  const key = gameKey.toUpperCase();
  const cached = gameCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return { data: cached.data as ReturnType<typeof Object>, fromCache: true };

  const { data: game, error } = await supabase
    .from('games')
    .select('*')
    .eq('game_key', key)
    .is('deleted_at', null)
    .single();

  if (error || !game) return { data: null, fromCache: false };

  gameCache.set(key, { data: game, expiresAt: Date.now() + 4000 });
  return { data: game, fromCache: false };
}

function updateGameCache(gameKey: string, game: unknown) {
  gameCache.set(gameKey.toUpperCase(), { data: game, expiresAt: Date.now() + 4000 });
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

  // Run game (cached) + team queries in parallel, team list from cache
  const [{ data: gameData }, teamRes, teams] = await Promise.all([
    getCachedGame(supabase, gameKey),
    supabase.from('teams').select('*').eq('id', teamId).single(),
    getCachedTeams(supabase, gameId),
  ]);

  if (!gameData) {
    return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
  }
  if (teamRes.error || !teamRes.data) {
    return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let game = gameData as any;
  const team = teamRes.data;

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
      if (finished) {
        game = finished;
        // Write finished state back to cache immediately so other pollers
        // within the same 4s window see the updated status without a DB hit.
        updateGameCache(gameKey, game);
      }
    }
  }

  // ── Remote mode: include team members with online status ──────────────────
  let members: Array<{ id: string; name: string; online: boolean }> | undefined;
  if (team.join_code) {
    const { data: rows } = await supabase
      .from('team_members')
      .select('id, name, last_seen_at')
      .eq('team_id', team.id)
      .order('created_at', { ascending: true });

    if (rows) {
      const cutoff = Date.now() - ONLINE_THRESHOLD_MS;
      members = rows.map((r: { id: string; name: string; last_seen_at: string }) => ({
        id: r.id,
        name: r.name,
        online: new Date(r.last_seen_at).getTime() > cutoff,
      }));
    }
  }

  return NextResponse.json({ game, team, teams: teams ?? [], ...(members ? { members } : {}) });
}
