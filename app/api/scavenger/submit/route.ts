// app/api/scavenger/submit/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';
import { ratePhoto as aiRatePhoto } from '@/lib/ai-photo-rater';

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

  const { error } = await supabase
    .from('scavenger_submissions')
    .upsert(
      {
        team_id: teamId,
        team_name: teamName,
        game_id: gameId,
        mission_id: missionId,
        item_id: itemId,
        item_label: itemLabel,
        photo_url: photoUrl,
        status: 'pending',
        points_awarded: null,
        ai_rated: false,
      },
      { onConflict: 'team_id,mission_id,item_id', ignoreDuplicates: false }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attempt AI rating after responding to player
  (async () => {
    try {
      const { data: game } = await supabase
        .from('games')
        .select('ai_photo_rating, ai_photo_instructions, mission_max_pts')
        .eq('id', gameId)
        .single();

      if (!game?.ai_photo_rating) return;

      const missionDescription =
        `Scavenger Hunt — teams must photograph: ${itemLabel ?? 'the required item'}. Did they find it?`;

      const mission = MISSIONS.find(m => m.id === missionId);
      const maxPts =
        (game.mission_max_pts as Record<string, number>)?.[missionId] ??
        mission?.maxPts ??
        500;

      const points = await aiRatePhoto({
        photoUrl,
        missionDescription,
        maxPts,
        scoringFocus: game.ai_photo_instructions,
      });

      // Mark submission as AI-rated
      await supabase
        .from('scavenger_submissions')
        .update({ status: 'rated', points_awarded: points, ai_rated: true })
        .eq('team_id', teamId)
        .eq('mission_id', missionId)
        .eq('item_id', itemId);

      // Add points to team
      const { data: team } = await supabase
        .from('teams')
        .select('score, completed, pending_notification')
        .eq('id', teamId)
        .single();

      if (!team) return;

      const missionName = mission ? `${mission.icon} ${mission.name}` : 'Scavenger Hunt';
      const notification = points > 0
        ? { type: 'photo_rated', message: `Your photo for "${itemLabel}" in ${missionName} was rated by AI! You earned ${points} points! ✨` }
        : { type: 'photo_rated', message: `Your photo for "${itemLabel}" was reviewed — unfortunately no points this time. Keep going! 💪` };

      const alreadyCompleted = team.completed?.includes(missionId);

      await supabase.from('teams').update({
        score: (team.score ?? 0) + points,
        completed: alreadyCompleted
          ? team.completed
          : points > 0
            ? [...(team.completed ?? []), missionId]
            : team.completed,
        pending_notification: notification,
        updated_at: new Date().toISOString(),
      }).eq('id', teamId);
    } catch (err) {
      console.error('[ai-photo-rating] Failed to auto-rate scavenger photo:', err);
    }
  })();

  return NextResponse.json({ ok: true });
}
