import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';
import { validateAdminToken, unauthorizedResponse, requireTeamOwnership } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { submissionId, teamId, missionId, itemLabel, points } = await req.json();

  if (!submissionId || !teamId || !missionId || points === undefined) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  const { denied } = await requireTeamOwnership(supabase, admin, teamId);
  if (denied) return denied;

  // Fetch existing submission to determine if this is a re-rate
  const { data: existingSub } = await supabase
    .from('scavenger_submissions')
    .select('status, points_awarded, team_id')
    .eq('id', submissionId)
    .single();

  if (!existingSub || existingSub.team_id !== teamId) {
    return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
  }

  const wasAlreadyRated = existingSub?.status === 'rated';
  const oldPoints = wasAlreadyRated ? (existingSub?.points_awarded ?? 0) : 0;
  const scoreDiff = points - oldPoints;

  // Mark submission as manually rated (clears ai_rated flag)
  const { error: subErr } = await supabase
    .from('scavenger_submissions')
    .update({ status: 'rated', points_awarded: points, ai_rated: false })
    .eq('id', submissionId);

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  // No score change needed if diff is zero
  if (scoreDiff === 0) return NextResponse.json({ ok: true });

  // Add points to team
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('score, completed, pending_notification')
    .eq('id', teamId)
    .single();

  if (teamErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  const mission = MISSIONS.find(m => m.id === missionId);
  const missionName = mission ? `${mission.icon} ${mission.name}` : 'Scavenger Hunt';

  const notification = points > 0
    ? { type: 'photo_rated', msgKey: 'photo_rated_earned_item', params: { item: itemLabel ?? '', mission: missionName, points } }
    : { type: 'photo_rated', msgKey: 'photo_rated_no_points', params: { mission: missionName } };

  const alreadyCompleted = team.completed?.includes(missionId);

  const { error: updateErr } = await supabase
    .from('teams')
    .update({
      score: Math.max(0, (team.score ?? 0) + scoreDiff),
      completed: alreadyCompleted
        ? team.completed
        : points > 0
          ? [...(team.completed ?? []), missionId]
          : team.completed,
      pending_notification: notification,
      updated_at: new Date().toISOString(),
    })
    .eq('id', teamId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
