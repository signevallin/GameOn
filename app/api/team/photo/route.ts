// app/api/team/photo/route.ts
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

  const { teamId, teamName, missionId, photoUrl } = await req.json();

  if (!teamId || !missionId || !photoUrl) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }

  // Insert submission — return id for potential AI update
  const { data: insertedSub, error } = await supabase
    .from('photo_submissions')
    .insert({
      team_id: teamId,
      team_name: teamName,
      mission_id: missionId,
      photo_url: photoUrl,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Respond to player immediately — AI rating happens after
  // Fire-and-forget pattern: we await inline but errors are caught and swallowed
  // so the player's submission is never blocked by AI latency.
  (async () => {
    try {
      // Get game settings via team → game
      const { data: teamRow } = await supabase
        .from('teams')
        .select('game_id')
        .eq('id', teamId)
        .single();

      if (!teamRow?.game_id) return;

      const { data: game } = await supabase
        .from('games')
        .select('ai_photo_rating, ai_photo_instructions, mission_max_pts')
        .eq('id', teamRow.game_id)
        .single();

      if (!game?.ai_photo_rating) return;

      // Resolve mission description
      const mission = MISSIONS.find(m => m.id === missionId);
      let missionDescription = mission
        ? `${mission.name}: ${mission.desc}`
        : 'Photo challenge';

      if (!mission) {
        // Try custom mission
        const { data: custom } = await supabase
          .from('custom_missions')
          .select('name, data')
          .eq('id', missionId)
          .single();
        if (custom) {
          const prompt = (custom.data as Record<string, unknown>)?.prompt as string | undefined;
          missionDescription = prompt ? `${custom.name}: ${prompt}` : (custom.name as string);
        }
      }

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

      // Re-check: if admin already rated this while AI was processing, skip team update
      const { data: currentSub } = await supabase
        .from('photo_submissions')
        .select('status')
        .eq('id', insertedSub.id)
        .single();
      if (currentSub?.status === 'rated') return;

      // Mark submission as AI-rated
      await supabase
        .from('photo_submissions')
        .update({ status: 'rated', points_awarded: points, ai_rated: true })
        .eq('id', insertedSub.id);

      // Add points to team (same logic as /api/admin/photos/rate — first time only)
      const { data: team } = await supabase
        .from('teams')
        .select('score, completed, mission_scores')
        .eq('id', teamId)
        .single();

      if (!team) return;

      const missionName = mission ? `${mission.icon} ${mission.name}` : 'Photo Challenge';
      const notification = points > 0
        ? { type: 'photo_rated', message: `Your photo for "${missionName}" was rated by AI! You earned ${points} points! ✨` }
        : { type: 'photo_rated', message: `Your photo for "${missionName}" was reviewed — unfortunately no points this time. Keep going! 💪` };

      if (!team.completed?.includes(missionId)) {
        const newMissionScores = { ...(team.mission_scores ?? {}), [missionId]: points };
        await supabase.from('teams').update({
          score: (team.score ?? 0) + points,
          completed: points > 0
            ? [...(team.completed ?? []), missionId]
            : (team.completed ?? []),
          mission_scores: newMissionScores,
          pending_notification: notification,
          updated_at: new Date().toISOString(),
        }).eq('id', teamId);
      }
    } catch (err) {
      console.error('[ai-photo-rating] Failed to auto-rate photo:', err);
      // Submission stays as 'pending' — admin can rate manually
    }
  })();

  return NextResponse.json({ ok: true });
}
