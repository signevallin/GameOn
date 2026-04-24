import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { teamId, teamName, gameId, missionId, itemId, itemLabel, photoUrl } = await req.json();

  if (!teamId || !gameId || !missionId || !itemId || !photoUrl) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  // Upsert so a team can replace a previously submitted photo for the same item
  const { error } = await supabase
    .from('scavenger_submissions')
    .upsert(
      { team_id: teamId, team_name: teamName, game_id: gameId, mission_id: missionId, item_id: itemId, item_label: itemLabel, photo_url: photoUrl, status: 'pending', points_awarded: null },
      { onConflict: 'team_id,mission_id,item_id', ignoreDuplicates: false }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
