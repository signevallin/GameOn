import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { submissionId, teamId, missionId, itemLabel, points } = await req.json();

  if (!submissionId || !teamId || !missionId || points === undefined) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  // Update submission status
  const { error: subErr } = await supabase
    .from('scavenger_submissions')
    .update({ status: 'rated', points_awarded: points })
    .eq('id', submissionId);

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  if (points === 0) return NextResponse.json({ ok: true });

  // Add points to team
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('score, completed, pending_notification')
    .eq('id', teamId)
    .single();

  if (teamErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  const mission = MISSIONS.find(m => m.id === missionId);
  const missionName = mission ? `${mission.icon} ${mission.name}` : 'Scavenger Hunt';

  const notification = {
    type: 'photo_rated',
    message: `Your photo for "${itemLabel}" in ${missionName} was rated! You earned ${points} points! 🎉`,
  };

  const alreadyCompleted = team.completed?.includes(missionId);

  const { error: updateErr } = await supabase
    .from('teams')
    .update({
      score: (team.score ?? 0) + points,
      completed: alreadyCompleted ? team.completed : [...(team.completed ?? []), missionId],
      pending_notification: notification,
      updated_at: new Date().toISOString(),
    })
    .eq('id', teamId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
