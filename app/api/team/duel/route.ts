import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/team/duel
 * Body: { senderTeamId, targetTeamId, correctCount }
 *
 * Deducts stolen points from the target team.
 * Adding the stolen pts to the sender is handled by the normal
 * /api/team/score call that ChallengeScreen makes via onFinish.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { senderTeamId, targetTeamId, correctCount } = body;

  if (!senderTeamId || !targetTeamId || correctCount == null) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }
  if (senderTeamId === targetTeamId) {
    return NextResponse.json({ error: 'Cannot duel your own team.' }, { status: 400 });
  }
  if (correctCount === 0) {
    return NextResponse.json({ stolen: 0 });
  }

  const supabase = getSupabase();

  const { data: target, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', targetTeamId)
    .single();

  if (error || !target) {
    return NextResponse.json({ error: 'Target team not found.' }, { status: 404 });
  }

  // 10% of target score per correct answer, max 30%
  const pct = Math.min(correctCount * 0.10, 0.30);
  const stolen = Math.round((target.score ?? 0) * pct);
  const newTargetScore = Math.max(0, (target.score ?? 0) - stolen);

  await supabase
    .from('teams')
    .update({
      score: newTargetScore,
      pending_notification: {
        type: 'powerup_received',
        message: `⚔️ Your team was challenged to a duel! The opponent answered ${correctCount}/3 questions correctly and stole ${stolen} points from you!`,
      },
    })
    .eq('id', targetTeamId);

  return NextResponse.json({ stolen, newTargetScore });
}
