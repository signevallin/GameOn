import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { teamId, missionId } = await req.json();

  if (!teamId || !missionId) {
    return NextResponse.json({ error: 'Missing teamId or missionId.' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('scavenger_submissions')
    .select('*')
    .eq('team_id', teamId)
    .eq('mission_id', missionId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data });
}
