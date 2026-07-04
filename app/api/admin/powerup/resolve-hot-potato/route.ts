// app/api/admin/powerup/resolve-hot-potato/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse, requireGameOwnership } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { gameId } = await req.json();
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const supabase = getSupabase();

  const denied = await requireGameOwnership(supabase, admin, gameId);
  if (denied) return denied;

  const { data: game, error: gameErr } = await supabase
    .from('games').select('hot_potato').eq('id', gameId).single();

  if (gameErr || !game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });

  const hp = game.hot_potato as {
    mission_id: string;
    expires_at: string;
    penalty_pts: number;
    game_id: string;
  } | null;

  if (!hp) return NextResponse.json({ ok: true, status: 'no_active' });

  const now = new Date();
  if (now < new Date(hp.expires_at)) {
    return NextResponse.json({ ok: true, status: 'not_expired', expires_at: hp.expires_at });
  }

  // Expired — penalize teams that haven't completed the mission
  const { data: teams, error: teamsErr } = await supabase
    .from('teams').select('id, score, completed').eq('game_id', hp.game_id);

  if (teamsErr || !teams) return NextResponse.json({ error: 'Could not load teams.' }, { status: 500 });

  const penalizedTeams: string[] = [];
  for (const team of teams) {
    const completed: string[] = team.completed ?? [];
    if (!completed.includes(hp.mission_id)) {
      await supabase.from('teams').update({
        score: Math.max(0, (team.score ?? 0) - hp.penalty_pts),
        pending_notification: {
          type: 'hot_potato_penalty',
          msgKey: 'hot_potato_penalty_msg',
          params: { penalty: hp.penalty_pts },
        },
        updated_at: now.toISOString(),
      }).eq('id', team.id);
      penalizedTeams.push(team.id);
    }
  }

  // Clear hot_potato on the game
  await supabase.from('games').update({
    hot_potato: null,
    updated_at: now.toISOString(),
  }).eq('id', gameId);

  return NextResponse.json({ ok: true, status: 'resolved', penalized: penalizedTeams.length });
}
