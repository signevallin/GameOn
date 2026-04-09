import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { teamId, teamName, missionId, photoUrl } = await req.json();

  if (!teamId || !missionId || !photoUrl) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  const { error } = await supabase.from('photo_submissions').insert({
    team_id: teamId,
    team_name: teamName,
    mission_id: missionId,
    photo_url: photoUrl,
    status: 'pending',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
