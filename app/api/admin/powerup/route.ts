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

const VALID_TYPES = ['sabotage', 'double_points', 'fake_hint', 'final_frenzy', 'point_steal', 'hot_potato'];

export async function POST(req: Request) {
  const { type, targetTeamId, message, gameId, fromTeamId, toTeamId, amount, missionId, missionName } = await req.json();

  if (!type) return NextResponse.json({ error: 'Missing type.' }, { status: 400 });
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type.' }, { status: 400 });
  if (type === 'fake_hint' && !message?.trim()) return NextResponse.json({ error: 'Message required for fake_hint.' }, { status: 400 });

  const supabase = getSupabase();

  // ── POINT STEAL ─────────────────────────────────────────────────────────────
  if (type === 'point_steal') {
    if (!fromTeamId || !toTeamId) return NextResponse.json({ error: 'fromTeamId and toTeamId required.' }, { status: 400 });
    if (!amount || ![100, 200, 300, 400, 500].includes(amount)) return NextResponse.json({ error: 'Invalid amount.' }, { status: 400 });
    if (fromTeamId === toTeamId) return NextResponse.json({ error: 'Cannot steal from the same team.' }, { status: 400 });

    const { data: fromTeam, error: fromErr } = await supabase
      .from('teams').select('score, active_effects, name').eq('id', fromTeamId).single();
    const { data: toTeam, error: toErr } = await supabase
      .from('teams').select('score, name').eq('id', toTeamId).single();

    if (fromErr || !fromTeam) return NextResponse.json({ error: 'From-team not found.' }, { status: 404 });
    if (toErr || !toTeam) return NextResponse.json({ error: 'To-team not found.' }, { status: 404 });

    const effects = (fromTeam.active_effects as Record<string, string>) ?? {};
    const shieldUntil = effects.shield_until ? new Date(effects.shield_until) : null;
    if (shieldUntil && shieldUntil > new Date()) {
      return NextResponse.json({ error: `${fromTeam.name} has a shield! Point steal blocked.` }, { status: 400 });
    }

    const stolen = Math.min(amount, fromTeam.score ?? 0);
    const now = new Date().toISOString();

    await supabase.from('teams').update({
      score: Math.max(0, (fromTeam.score ?? 0) - stolen),
      pending_notification: { type: 'point_steal_from', message: `😱 POINT STEAL! ${stolen} points were stolen from your team!` },
      updated_at: now,
    }).eq('id', fromTeamId);

    await supabase.from('teams').update({
      score: (toTeam.score ?? 0) + stolen,
      pending_notification: { type: 'point_steal_to', message: `🤑 POINT STEAL! You received ${stolen} stolen points!` },
      updated_at: now,
    }).eq('id', toTeamId);

    return NextResponse.json({ ok: true, stolen });
  }

  // ── HOT POTATO ───────────────────────────────────────────────────────────────
  if (type === 'hot_potato') {
    if (!missionId || !missionName) return NextResponse.json({ error: 'missionId and missionName required.' }, { status: 400 });
    if (!gameId) return NextResponse.json({ error: 'gameId required.' }, { status: 400 });

    const { data: existingSettings } = await supabase
      .from('settings').select('hot_potato').eq('id', 1).single();

    if (existingSettings?.hot_potato) {
      return NextResponse.json({ error: 'A Hot Potato is already active.' }, { status: 409 });
    }

    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    const hotPotatoData = { mission_id: missionId, expires_at: expiresAt, penalty_pts: 200, game_id: gameId };

    await supabase.from('settings').update({ hot_potato: hotPotatoData, updated_at: new Date().toISOString() }).eq('id', 1);

    // Notify all teams
    const { data: allTeams } = await supabase.from('teams').select('id').eq('game_id', gameId);
    if (allTeams) {
      for (const t of allTeams) {
        await supabase.from('teams').update({
          pending_notification: {
            type: 'hot_potato',
            message: `🥔 HOT POTATO! Complete '${missionName}' within 3 minutes or lose 200 points!`,
          },
          updated_at: new Date().toISOString(),
        }).eq('id', t.id);
      }
    }

    return NextResponse.json({ ok: true, expiresAt });
  }

  // final_frenzy and "all" broadcasts require gameId
  const isBroadcast = type === 'final_frenzy' || targetTeamId === 'all';
  if (isBroadcast && !gameId) return NextResponse.json({ error: 'gameId required for broadcast.' }, { status: 400 });
  if (!isBroadcast && !targetTeamId) return NextResponse.json({ error: 'Missing targetTeamId.' }, { status: 400 });

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
