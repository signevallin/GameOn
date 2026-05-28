import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const VALID_TYPES = ['freeze', 'double_trouble', 'shield', 'all_in', 'point_steal'] as const;
type PowerUpType = typeof VALID_TYPES[number];

export async function POST(req: Request) {
  const { type, senderTeamId, targetTeamId } = await req.json();

  if (!type || !senderTeamId) return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type.' }, { status: 400 });

  const supabase = getSupabase();

  // Load sender
  const { data: sender, error: senderErr } = await supabase
    .from('teams')
    .select('*')
    .eq('id', senderTeamId)
    .single();
  if (senderErr || !sender) return NextResponse.json({ error: 'Sender not found.' }, { status: 404 });

  const usedPowerups: string[] = sender.team_powerups_used ?? [];
  if (usedPowerups.includes(type)) {
    return NextResponse.json({ error: 'You have already used this power-up.' }, { status: 409 });
  }

  // Self-targeting power-ups
  if (type === 'shield') {
    const shieldUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const effects = sender.active_effects ?? {};
    await supabase.from('teams').update({
      active_effects: { ...effects, shield_until: shieldUntil },
      team_powerups_used: [...usedPowerups, type],
      pending_notification: { type: 'powerup_self', message: `🛡️ Shield activated! You are immune to sabotage for 2 minutes.` },
    }).eq('id', senderTeamId);

    return NextResponse.json({ ok: true });
  }

  // Offensive power-ups — need a target
  if (!targetTeamId) return NextResponse.json({ error: 'Target team required.' }, { status: 400 });
  if (targetTeamId === senderTeamId) return NextResponse.json({ error: 'Cannot target your own team.' }, { status: 400 });

  const { data: target, error: targetErr } = await supabase
    .from('teams')
    .select('*')
    .eq('id', targetTeamId)
    .single();
  if (targetErr || !target) return NextResponse.json({ error: 'Target team not found.' }, { status: 404 });

  // Check shield
  const targetEffects = target.active_effects ?? {};
  const shieldUntil = targetEffects.shield_until ? new Date(targetEffects.shield_until) : null;
  if (shieldUntil && shieldUntil > new Date()) {
    // Mark sender as used anyway, but block the effect
    await supabase.from('teams').update({ team_powerups_used: [...usedPowerups, type] }).eq('id', senderTeamId);
    return NextResponse.json({ ok: true, blocked: true, message: 'That team has a shield active! Your power-up was wasted. 🛡️' });
  }

  // Count this hit against the target (for stats)
  await supabase.from('teams')
    .update({ powerups_received: (target.powerups_received ?? 0) + 1 })
    .eq('id', targetTeamId);

  if (type === 'freeze') {
    const freezeUntil = new Date(Date.now() + 60 * 1000).toISOString();
    await supabase.from('teams').update({
      active_effects: { ...targetEffects, freeze_until: freezeUntil },
      pending_notification: { type: 'powerup_received', message: `❄️ You have been FROZEN! You can't do anything for 60 seconds.` },
    }).eq('id', targetTeamId);
  }

  if (type === 'double_trouble') {
    // Fetch the game to get its mission list
    const { data: game } = await supabase.from('games').select('missions').eq('id', target.game_id).single();
    const gameMissionIds: string[] = game?.missions ?? [];
    const completed = (target.completed ?? []) as string[];
    const undone = MISSIONS.filter(m =>
      (gameMissionIds.length === 0 || gameMissionIds.includes(m.id)) &&
      !completed.includes(m.id) &&
      m.type !== 'photo'  // exclude photo missions — teams can't be forced to submit photos
    );
    const shuffled = [...undone].sort(() => Math.random() - 0.5);
    const penaltyIds = shuffled.slice(0, 2).map(m => m.id);

    await supabase.from('teams').update({
      active_effects: {
        ...targetEffects,
        double_trouble_remaining: 2,
        double_trouble_missions: penaltyIds,
      },
      pending_notification: { type: 'powerup_received', message: `😈 DOUBLE TROUBLE! You must complete 2 assigned missions before you can play freely again.` },
    }).eq('id', targetTeamId);
  }

  if (type === 'all_in') {
    const senderScore = sender.score ?? 0;
    const targetScore = target.score ?? 0;
    const wager = Math.floor(senderScore * 0.3);
    const won = Math.random() < 0.5;
    const prize = Math.floor(targetScore * 0.3);

    if (won) {
      // Sender wins: gains 30% of target's points, target loses them
      const newSenderScore = senderScore + prize;
      const newTargetScore = Math.max(0, targetScore - prize);
      await supabase.from('teams').update({
        score: newSenderScore,
      }).eq('id', senderTeamId);
      await supabase.from('teams').update({
        score: newTargetScore,
        pending_notification: { type: 'powerup_received', message: `🎲 ALL IN! Another team gambled against you — and won! They took ${prize} pts (30%) from you.` },
      }).eq('id', targetTeamId);

      // Mark sender used + attach result
      await supabase.from('teams').update({ team_powerups_used: [...usedPowerups, type] }).eq('id', senderTeamId);
      return NextResponse.json({ ok: true, won: true, newSenderScore, resultMessage: `🎲 You won the gamble! +${prize} pts stolen from ${target.name}!` });
    } else {
      // Sender loses: target gains 30% of sender's points, sender loses them
      const newSenderScore = Math.max(0, senderScore - wager);
      const newTargetScore = targetScore + wager;
      await supabase.from('teams').update({
        score: newSenderScore,
      }).eq('id', senderTeamId);
      await supabase.from('teams').update({
        score: newTargetScore,
        pending_notification: { type: 'powerup_self', message: `🎲 ALL IN backfired on your rival! They gambled against you and lost — you gained ${wager} pts!` },
      }).eq('id', targetTeamId);

      // Mark sender used + attach result
      await supabase.from('teams').update({ team_powerups_used: [...usedPowerups, type] }).eq('id', senderTeamId);
      return NextResponse.json({ ok: true, won: false, newSenderScore, resultMessage: `🎲 You lost the gamble… -${wager} pts went to ${target.name}.` });
    }
  }

  if (type === 'point_steal') {
    const targetScore = target.score ?? 0;
    const senderScore = sender.score ?? 0;
    const stolen = Math.min(500, targetScore);

    await supabase.from('teams').update({
      score: Math.max(0, targetScore - stolen),
      pending_notification: { type: 'point_steal_from', message: `😱 POINT STEAL! ${stolen} points were stolen from your team!` },
    }).eq('id', targetTeamId);

    await supabase.from('teams').update({
      score: senderScore + stolen,
      team_powerups_used: [...usedPowerups, type],
      pending_notification: { type: 'point_steal_to', message: `🤑 You stole ${stolen} pts from ${target.name}!` },
    }).eq('id', senderTeamId);

    return NextResponse.json({ ok: true, stolen, resultMessage: `🤑 You stole ${stolen} pts from ${target.name}!` });
  }

  // Mark sender powerup as used
  await supabase.from('teams').update({
    team_powerups_used: [...usedPowerups, type],
  }).eq('id', senderTeamId);

  return NextResponse.json({ ok: true });
}
