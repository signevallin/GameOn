import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyGameUpdated } from '@/lib/realtime-server';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/team/answer
// Body: { teamId, missionId, answer }
// Merges the answer into the team's mission_answers JSONB field.
export async function POST(req: Request) {
  const { teamId, missionId, answer } = await req.json();
  if (!teamId || !missionId || !answer) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  const supabase = getSupabase();

  const { error } = await supabase.rpc('merge_mission_answer', {
    p_team_id: teamId,
    p_mission_id: missionId,
    p_answer: answer,
  });

  if (error) {
    // Fallback: manual merge if RPC doesn't exist yet
    const { data: team } = await supabase
      .from('teams')
      .select('mission_answers')
      .eq('id', teamId)
      .single();

    const current = (team?.mission_answers as Record<string, string>) ?? {};
    const { error: updateErr } = await supabase
      .from('teams')
      .update({ mission_answers: { ...current, [missionId]: answer } })
      .eq('id', teamId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  await notifyGameUpdated(supabase, { teamId }, 'answer');
  return NextResponse.json({ ok: true });
}
