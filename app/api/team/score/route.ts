import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { teamId, missionId, points } = await req.json();

  if (!teamId || !missionId) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  const { data: team, error: fetchErr } = await supabase
    .from('teams')
    .select('score, completed')
    .eq('id', teamId)
    .single();

  if (fetchErr || !team) {
    return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  }

  if (team.completed?.includes(missionId)) {
    return NextResponse.json({ error: 'Already completed.' }, { status: 409 });
  }

  const newCompleted = [...(team.completed ?? []), missionId];
  const newScore = (team.score ?? 0) + (points ?? 0);

  const { data, error } = await supabase
    .from('teams')
    .update({ score: newScore, completed: newCompleted, updated_at: new Date().toISOString() })
    .eq('id', teamId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ team: data });
}
