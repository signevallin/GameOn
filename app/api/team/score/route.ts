import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    .select('score, completed, mission_scores, double_points, active_effects')
    .eq('id', teamId)
    .single();

  if (fetchErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  if (team.completed?.includes(missionId)) return NextResponse.json({ error: 'Already completed.' }, { status: 409 });

  const prevScores = (team.mission_scores as Record<string, number>) ?? {};
  const finalPts = team.double_points ? (points ?? 0) * 2 : (points ?? 0);
  const effects = (team.active_effects as Record<string, unknown>) ?? {};

  const updatePayload: Record<string, unknown> = {
    score: (team.score ?? 0) + finalPts,
    completed: [...(team.completed ?? []), missionId],
    mission_scores: { ...prevScores, [missionId]: finalPts },
    updated_at: new Date().toISOString(),
  };

  if (team.double_points) {
    updatePayload.double_points = false;
  }

  // Decrement double_trouble counter
  if (effects.double_trouble_remaining && (effects.double_trouble_remaining as number) > 0) {
    const remaining = (effects.double_trouble_remaining as number) - 1;
    updatePayload.active_effects = { ...effects, double_trouble_remaining: remaining };
  }

  const { data, error } = await supabase
    .from('teams')
    .update(updatePayload)
    .eq('id', teamId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ team: data });
}
