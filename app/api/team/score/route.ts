import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { teamId, missionId, points } = await req.json();
  if (!teamId || !missionId) return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });

  const { data: team, error: fetchErr } = await supabase
    .from('teams')
    .select('id, game_id, score, completed, mission_scores, double_points, active_effects')
    .eq('id', teamId)
    .single();

  if (fetchErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  if (team.completed?.includes(missionId)) return NextResponse.json({ error: 'Already completed.' }, { status: 409 });

  const prevScores = (team.mission_scores as Record<string, number>) ?? {};
  const effects = (team.active_effects as Record<string, unknown>) ?? {};
  const isFinalFrenzy = effects.final_frenzy === true;

  // Double Agent: time-limited doubling — success doubles points, failure feeds last place
  const doubleAgentUntil = effects.double_agent_until ? new Date(effects.double_agent_until as string) : null;
  const isDoubleAgentActive = doubleAgentUntil ? doubleAgentUntil.getTime() > Date.now() : false;

  let finalPts: number;
  if (isDoubleAgentActive) {
    finalPts = (points ?? 0) > 0 ? (points ?? 0) * 2 : 0;
  } else {
    finalPts = (team.double_points || isFinalFrenzy) ? (points ?? 0) * 2 : (points ?? 0);
  }

  const newEffects: Record<string, unknown> = { ...effects };

  // Clear double_agent when it fires (success or failure)
  if (isDoubleAgentActive) {
    delete newEffects.double_agent_until;
  }

  const updatePayload: Record<string, unknown> = {
    score: (team.score ?? 0) + finalPts,
    completed: [...(team.completed ?? []), missionId],
    mission_scores: { ...prevScores, [missionId]: finalPts },
    active_effects: newEffects,
    updated_at: new Date().toISOString(),
  };

  // Only reset double_points if it was a one-time power-up, not Final Frenzy
  if (team.double_points && !isFinalFrenzy) {
    updatePayload.double_points = false;
  }

  const { data, error } = await supabase
    .from('teams')
    .update(updatePayload)
    .eq('id', teamId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Double Agent failure: give the doubled base pts to last-place team
  if (isDoubleAgentActive && (points ?? 0) === 0) {
    const mission = MISSIONS.find(m => m.id === missionId);
    const penaltyPts = mission ? mission.maxPts : 300;

    const { data: allTeams } = await supabase
      .from('teams')
      .select('id, score')
      .eq('game_id', team.game_id)
      .neq('id', teamId);

    const lastPlace = (allTeams ?? []).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];
    if (lastPlace) {
      await supabase
        .from('teams')
        .update({
          score: (lastPlace.score ?? 0) + penaltyPts,
          pending_notification: { type: 'powerup_self', msgKey: 'double_agent_last_msg', params: { pts: penaltyPts } },
        })
        .eq('id', lastPlace.id);
    }
  }

  return NextResponse.json({ team: data });
}
