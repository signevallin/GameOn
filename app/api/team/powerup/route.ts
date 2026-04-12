import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const VALID_TYPES = ['second_chance', 'freeze', 'double_trouble', 'shield', 'all_in'] as const;
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
  if (type === 'second_chance') {
    // Find a mission completed with 0 points (failed)
    const scores: Record<string, number> = sender.mission_scores ?? {};
    const failedMission = (sender.completed ?? []).find((id: string) => (scores[id] ?? 1) === 0);
    if (!failedMission) return NextResponse.json({ error: 'No failed missions to retry.' }, { status: 400 });

    const newCompleted = (sender.completed as string[]).filter((id: string) => id !== failedMission);
    await supabase.from('teams').update({
      completed: newCompleted,
      team_powerups_used: [...usedPowerups, type],
      pending_notification: { type: 'powerup_self', message: `🔄 Second Chance activated! You can retry the mission you failed.` },
    }).eq('id', senderTeamId);

    return NextResponse.json({ ok: true });
  }

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

  if (type === 'freeze') {
    const freezeUntil = new Date(Date.now() + 60 * 1000).toISOString();
    await supabase.from('teams').update({
      active_effects: { ...targetEffects, freeze_until: freezeUntil },
      pending_notification: { type: 'powerup_received', message: `❄️ You have been FROZEN! You can't do anything for 60 seconds.` },
    }).eq('id', targetTeamId);
  }

  if (type === 'double_trouble') {
    await supabase.from('teams').update({
      active_effects: { ...targetEffects, double_trouble_remaining: (targetEffects.double_trouble_remaining ?? 0) + 2 },
      pending_notification: { type: 'powerup_received', message: `😈 DOUBLE TROUBLE! You must complete 2 missions before your next one unlocks.` },
    }).eq('id', targetTeamId);
  }

  if (type === 'all_in') {
    const stolen = Math.floor((target.score ?? 0) * 0.5);
    await supabase.from('teams').update({
      score: Math.max(0, (target.score ?? 0) - stolen),
      pending_notification: { type: 'powerup_received', message: `💸 ALL IN! Another team stole 50% of your points (${stolen} pts)!` },
    }).eq('id', targetTeamId);
    // Give stolen points to sender
    await supabase.from('teams').update({
      score: (sender.score ?? 0) + stolen,
    }).eq('id', senderTeamId);
  }

  // Mark sender powerup as used
  await supabase.from('teams').update({
    team_powerups_used: [...usedPowerups, type],
  }).eq('id', senderTeamId);

  return NextResponse.json({ ok: true });
}
