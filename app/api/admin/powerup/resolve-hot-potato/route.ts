import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST() {
  const supabase = getSupabase();

  const { data: settings, error: settingsErr } = await supabase
    .from('settings')
    .select('hot_potato')
    .eq('id', 1)
    .single();

  if (settingsErr || !settings) {
    return NextResponse.json({ error: 'Could not load settings.' }, { status: 500 });
  }

  const hp = settings.hot_potato as {
    mission_id: string;
    expires_at: string;
    penalty_pts: number;
    game_id: string;
  } | null;

  if (!hp) {
    return NextResponse.json({ ok: true, status: 'no_active' });
  }

  const now = new Date();
  const expiresAt = new Date(hp.expires_at);

  if (now < expiresAt) {
    return NextResponse.json({ ok: true, status: 'not_expired', expires_at: hp.expires_at });
  }

  // Expired — penalize teams that haven't completed the mission
  const { data: teams, error: teamsErr } = await supabase
    .from('teams')
    .select('id, score, completed')
    .eq('game_id', hp.game_id);

  if (teamsErr || !teams) {
    return NextResponse.json({ error: 'Could not load teams.' }, { status: 500 });
  }

  const penalizedTeams: string[] = [];

  for (const team of teams) {
    const completed: string[] = team.completed ?? [];
    if (!completed.includes(hp.mission_id)) {
      const newScore = Math.max(0, (team.score ?? 0) - hp.penalty_pts);
      await supabase.from('teams').update({
        score: newScore,
        pending_notification: {
          type: 'hot_potato_penalty',
          message: `🥔 TIME'S UP! You didn't complete the Hot Potato mission in time. -${hp.penalty_pts} points!`,
        },
        updated_at: now.toISOString(),
      }).eq('id', team.id);
      penalizedTeams.push(team.id);
    }
  }

  // Clear hot_potato from settings
  await supabase.from('settings').update({
    hot_potato: null,
    updated_at: now.toISOString(),
  }).eq('id', 1);

  return NextResponse.json({ ok: true, status: 'resolved', penalized: penalizedTeams.length });
}
