import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { submissionId, teamId, missionId, points } = await req.json();

  if (!submissionId || !teamId || !missionId || points === undefined) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  const { error: subErr } = await supabase
    .from('photo_submissions')
    .update({ status: 'rated', points_awarded: points })
    .eq('id', submissionId);

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('score, completed')
    .eq('id', teamId)
    .single();

  if (teamErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  const mission = MISSIONS.find(m => m.id === missionId);
  const missionName = mission ? `${mission.icon} ${mission.name}` : 'Photo Challenge';

  const notification = points > 0
    ? { type: 'photo_rated', message: `Your photo for "${missionName}" has been rated! You earned ${points} points! 🎉` }
    : { type: 'photo_rated', message: `Your photo for "${missionName}" was reviewed — unfortunately no points this time. Keep going! 💪` };

  if (!team.completed?.includes(missionId)) {
    const { error: updateErr } = await supabase
      .from('teams')
      .update({
        score: (team.score ?? 0) + points,
        completed: [...(team.completed ?? []), missionId],
        pending_notification: notification,
        updated_at: new Date().toISOString(),
      })
      .eq('id', teamId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  } else {
    // Already completed (re-rating) — still send the notification
    const { error: updateErr } = await supabase
      .from('teams')
      .update({ pending_notification: notification, updated_at: new Date().toISOString() })
      .eq('id', teamId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
