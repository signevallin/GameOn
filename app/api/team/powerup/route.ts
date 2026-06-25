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

const VALID_TYPES = ['freeze', 'inverterad_skarm', 'shield', 'all_in', 'double_agent', 'robin_hood'] as const;
type PowerUpType = typeof VALID_TYPES[number];

function markPowerupUsed(
  type: string,
  usedPowerups: string[],
  extraPowerups: string[],
  hasExtra: boolean
): Record<string, unknown> {
  if (hasExtra) {
    const idx = extraPowerups.indexOf(type);
    return {
      extra_powerups: [
        ...extraPowerups.slice(0, idx),
        ...extraPowerups.slice(idx + 1),
      ],
    };
  }
  return { team_powerups_used: [...usedPowerups, type] };
}

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
  const extraPowerups: string[] = sender.extra_powerups ?? [];
  const hasExtra = extraPowerups.includes(type);
  if (usedPowerups.includes(type) && !hasExtra) {
    return NextResponse.json({ error: 'You have already used this power-up.' }, { status: 409 });
  }

  // Self-targeting power-ups
  if (type === 'shield') {
    const shieldUntil = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const effects = sender.active_effects ?? {};
    await supabase.from('teams').update({
      active_effects: { ...effects, shield_until: shieldUntil },
      ...markPowerupUsed(type, usedPowerups, extraPowerups, hasExtra),
      pending_notification: { type: 'powerup_self', msgKey: 'shield_msg', params: {} },
    }).eq('id', senderTeamId);

    return NextResponse.json({ ok: true });
  }

  if (type === 'double_agent') {
    const doubleAgentUntil = new Date(Date.now() + 90 * 1000).toISOString();
    const senderEffects = sender.active_effects ?? {};
    await supabase.from('teams').update({
      active_effects: { ...senderEffects, double_agent_until: doubleAgentUntil },
      ...markPowerupUsed(type, usedPowerups, extraPowerups, hasExtra),
      pending_notification: { type: 'powerup_self', msgKey: 'double_agent_msg', params: {} },
    }).eq('id', senderTeamId);
    return NextResponse.json({ ok: true, resultMessage: '🕵️ Double Agent active for 90 seconds! Double points — but failure feeds the last-place team.' });
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
    await supabase.from('teams').update({ ...markPowerupUsed(type, usedPowerups, extraPowerups, hasExtra) }).eq('id', senderTeamId);
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
      pending_notification: { type: 'powerup_received', msgKey: 'frozen_msg', params: {} },
    }).eq('id', targetTeamId);
  }

  if (type === 'inverterad_skarm') {
    const inverteradUntil = new Date(Date.now() + 60 * 1000).toISOString();
    await supabase.from('teams').update({
      active_effects: { ...targetEffects, inverterad_skarm_until: inverteradUntil },
      pending_notification: { type: 'powerup_received', msgKey: 'inverterad_skarm_msg', params: {} },
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
        pending_notification: { type: 'powerup_received', msgKey: 'all_in_lost_msg', params: { prize } },
      }).eq('id', targetTeamId);

      // Mark sender used + attach result
      await supabase.from('teams').update({ ...markPowerupUsed(type, usedPowerups, extraPowerups, hasExtra) }).eq('id', senderTeamId);
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
        pending_notification: { type: 'powerup_self', msgKey: 'all_in_won_msg', params: { wager } },
      }).eq('id', targetTeamId);

      // Mark sender used + attach result
      await supabase.from('teams').update({ ...markPowerupUsed(type, usedPowerups, extraPowerups, hasExtra) }).eq('id', senderTeamId);
      return NextResponse.json({ ok: true, won: false, newSenderScore, resultMessage: `🎲 You lost the gamble… -${wager} pts went to ${target.name}.` });
    }
  }

  if (type === 'robin_hood') {
    const targetScore = target.score ?? 0;
    const stolen = Math.min(300, targetScore);

    // Find the poorest team (lowest score, excluding sender and target)
    const { data: allTeams } = await supabase
      .from('teams')
      .select('id, name, score')
      .eq('game_id', sender.game_id)
      .neq('id', senderTeamId)
      .neq('id', targetTeamId);

    const poorest = (allTeams ?? []).sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0];

    // Deduct from target
    await supabase.from('teams').update({
      score: Math.max(0, targetScore - stolen),
      pending_notification: { type: 'point_steal_from', msgKey: 'robin_hood_from_msg', params: { stolen } },
    }).eq('id', targetTeamId);

    // Give to poorest team (or sender if no other team exists)
    const recipientId = poorest?.id ?? senderTeamId;
    const recipientName = poorest?.name ?? sender.name;
    const recipientScore = poorest?.score ?? (sender.score ?? 0);
    await supabase.from('teams').update({
      score: recipientScore + stolen,
      pending_notification: { type: 'point_steal_to', msgKey: 'robin_hood_to_msg', params: { stolen } },
    }).eq('id', recipientId);

    // Mark sender as used
    await supabase.from('teams').update({
      ...markPowerupUsed(type, usedPowerups, extraPowerups, hasExtra),
      pending_notification: { type: 'powerup_self', msgKey: 'robin_hood_self_msg', params: { stolen, target: target.name, recipient: recipientName } },
    }).eq('id', senderTeamId);

    return NextResponse.json({ ok: true, stolen, resultMessage: `🏹 Stole ${stolen} pts from ${target.name} and gave to ${recipientName}!` });
  }

  // Mark sender powerup as used
  await supabase.from('teams').update({
    ...markPowerupUsed(type, usedPowerups, extraPowerups, hasExtra),
  }).eq('id', senderTeamId);

  return NextResponse.json({ ok: true });
}
