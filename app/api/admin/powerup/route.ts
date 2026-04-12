import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MESSAGES: Record<string, string> = {
  sabotage: '💻 YOU HAVE BEEN HACKED! -100 points deducted from your team',
  double_points: '🎯 POWER-UP! Double points on your next mission!',
  final_frenzy: '🔥 FINAL FRENZY ACTIVATED! All points are now doubled!',
};

const VALID_TYPES = ['sabotage', 'double_points', 'fake_hint', 'final_frenzy'];

export async function POST(req: Request) {
  const { type, targetTeamId, message, gameId } = await req.json();

  if (!type) return NextResponse.json({ error: 'Missing type.' }, { status: 400 });
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type.' }, { status: 400 });
  if (type === 'fake_hint' && !message?.trim()) return NextResponse.json({ error: 'Message required for fake_hint.' }, { status: 400 });

  // final_frenzy and "all" broadcasts require gameId
  const isBroadcast = type === 'final_frenzy' || targetTeamId === 'all';
  if (isBroadcast && !gameId) return NextResponse.json({ error: 'gameId required for broadcast.' }, { status: 400 });
  if (!isBroadcast && !targetTeamId) return NextResponse.json({ error: 'Missing targetTeamId.' }, { status: 400 });

  const supabase = getSupabase();

  // Check powerups_used
  const { data: settings, error: settingsErr } = await supabase
    .from('settings')
    .select('powerups_used')
    .eq('id', 1)
    .single();

  if (settingsErr || !settings) return NextResponse.json({ error: 'Could not load settings.' }, { status: 500 });

  const used: string[] = settings.powerups_used ?? [];
  const usedKey = isBroadcast ? `${type}_all` : `${type}_${targetTeamId}`;

  if (used.includes(usedKey)) {
    return NextResponse.json({ error: 'Power-up already used.' }, { status: 409 });
  }

  // ── BROADCAST (final_frenzy or all-teams) ────────────────────────────────
  if (isBroadcast) {
    const { data: allTeams, error: teamsErr } = await supabase
      .from('teams')
      .select('id, score, active_effects')
      .eq('game_id', gameId);

    if (teamsErr || !allTeams) return NextResponse.json({ error: 'Could not load teams.' }, { status: 500 });

    const notification = { type, message: MESSAGES[type] ?? message };

    const updates = allTeams.map(t => {
      const update: Record<string, unknown> = {
        id: t.id,
        pending_notification: notification,
        updated_at: new Date().toISOString(),
      };
      if (type === 'final_frenzy' || type === 'double_points') {
        update.double_points = true;
      }
      if (type === 'sabotage') {
        const effects = (t.active_effects as Record<string, string>) ?? {};
        const shieldUntil = effects.shield_until ? new Date(effects.shield_until) : null;
        if (!shieldUntil || shieldUntil <= new Date()) {
          update.score = Math.max(0, (t.score ?? 0) - 100);
        }
      }
      return update;
    });

    for (const upd of updates) {
      await supabase.from('teams').update(upd).eq('id', upd.id);
    }

    const { error: settingsUpdateErr } = await supabase
      .from('settings')
      .update({ powerups_used: [...used, usedKey], updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (settingsUpdateErr) return NextResponse.json({ error: settingsUpdateErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, usedKey, broadcast: true });
  }

  // ── SINGLE TEAM ─────────────────────────────────────────────────────────
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('score, active_effects')
    .eq('id', targetTeamId)
    .single();

  if (teamErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  if (type === 'sabotage') {
    const effects = (team.active_effects as Record<string, string>) ?? {};
    const shieldUntil = effects.shield_until ? new Date(effects.shield_until) : null;
    if (shieldUntil && shieldUntil > new Date()) {
      return NextResponse.json({ error: 'That team has a shield active! Sabotage blocked.' }, { status: 400 });
    }
  }

  const notification = {
    type,
    message: type === 'fake_hint' ? message.trim() : MESSAGES[type],
  };

  const teamUpdate: Record<string, unknown> = {
    pending_notification: notification,
    updated_at: new Date().toISOString(),
  };

  if (type === 'sabotage') teamUpdate.score = Math.max(0, (team.score ?? 0) - 100);
  if (type === 'double_points') teamUpdate.double_points = true;

  const { error: updateErr } = await supabase
    .from('teams')
    .update(teamUpdate)
    .eq('id', targetTeamId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const { error: settingsUpdateErr } = await supabase
    .from('settings')
    .update({ powerups_used: [...used, usedKey], updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (settingsUpdateErr) return NextResponse.json({ error: settingsUpdateErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, usedKey });
}
