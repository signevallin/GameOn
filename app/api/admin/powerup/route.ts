// app/api/admin/powerup/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';
import { MISSION_SUPER_CATEGORY, SUPER_CATEGORIES } from '@/lib/superCategories';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MSG_KEYS: Record<string, string> = {
  double_points: 'double_points_msg',
  final_frenzy: 'final_frenzy_msg',
  smoke_screen: 'smoke_screen_msg',
};

const VALID_TYPES = ['sabotage', 'double_points', 'fake_hint', 'final_frenzy', 'hot_potato', 'smoke_screen'];

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { type, targetTeamId, message, gameId, missionId, missionName } = await req.json();

  if (!type) return NextResponse.json({ error: 'Missing type.' }, { status: 400 });
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid type.' }, { status: 400 });
  if (type === 'fake_hint' && !message?.trim()) return NextResponse.json({ error: 'Message required for fake_hint.' }, { status: 400 });
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const supabase = getSupabase();

  // ── HOT POTATO ───────────────────────────────────────────────────────────────
  if (type === 'hot_potato') {
    if (!missionId || !missionName) return NextResponse.json({ error: 'missionId and missionName required.' }, { status: 400 });

    const { data: game } = await supabase
      .from('games').select('hot_potato').eq('id', gameId).single();

    if (game?.hot_potato) {
      return NextResponse.json({ error: 'A Hot Potato is already active.' }, { status: 409 });
    }

    const mission = MISSIONS.find(m => m.id === missionId);
    const superKey = missionId ? MISSION_SUPER_CATEGORY[missionId] : undefined;
    const superLabel = superKey ? SUPER_CATEGORIES[superKey].label : undefined;
    const missionLabel = mission
      ? `${mission.icon} ${mission.name}${superLabel ? ` (${superLabel})` : ''}`
      : missionName;

    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    const hotPotatoData = { mission_id: missionId, expires_at: expiresAt, penalty_pts: 500, game_id: gameId };

    await supabase.from('games').update({
      hot_potato: hotPotatoData,
      updated_at: new Date().toISOString(),
    }).eq('id', gameId);

    // Notify all teams
    const { data: allTeams } = await supabase.from('teams').select('id').eq('game_id', gameId);
    if (allTeams) {
      for (const t of allTeams) {
        await supabase.from('teams').update({
          pending_notification: {
            type: 'hot_potato',
            msgKey: 'hot_potato_msg',
            params: { mission: missionLabel, penalty: 500 },
          },
          updated_at: new Date().toISOString(),
        }).eq('id', t.id);
      }
    }

    return NextResponse.json({ ok: true, expiresAt });
  }

  // ── SABOTAGE / HACKED (reusable, no powerups_used tracking) ─────────────────
  if (type === 'sabotage') {
    if (!targetTeamId) return NextResponse.json({ error: 'Missing targetTeamId.' }, { status: 400 });

    const { data: team, error: teamErr } = await supabase
      .from('teams').select('active_effects').eq('id', targetTeamId).single();
    if (teamErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

    const effects = (team.active_effects as Record<string, unknown>) ?? {};
    const shieldUntil = effects.shield_until ? new Date(effects.shield_until as string) : null;
    if (shieldUntil && shieldUntil > new Date()) {
      return NextResponse.json({ error: 'That team has a shield active! Hack blocked.' }, { status: 400 });
    }

    const hackedUntil = new Date(Date.now() + 30 * 1000).toISOString();
    await supabase.from('teams').update({
      active_effects: { ...effects, hacked_until: hackedUntil },
      updated_at: new Date().toISOString(),
    }).eq('id', targetTeamId);

    return NextResponse.json({ ok: true });
  }

  // ── SMOKE SCREEN (reusable, no powerups_used tracking) ──────────────────────
  if (type === 'smoke_screen') {
    if (!targetTeamId) return NextResponse.json({ error: 'Missing targetTeamId.' }, { status: 400 });

    const { data: team, error: teamErr } = await supabase
      .from('teams').select('active_effects').eq('id', targetTeamId).single();
    if (teamErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

    const effects = (team.active_effects as Record<string, unknown>) ?? {};
    const shieldUntil = effects.shield_until ? new Date(effects.shield_until as string) : null;
    if (shieldUntil && shieldUntil > new Date()) {
      return NextResponse.json({ error: 'That team has a shield active! Smoke Screen blocked.' }, { status: 400 });
    }

    const smokeUntil = new Date(Date.now() + 30 * 1000).toISOString();
    await supabase.from('teams').update({
      active_effects: { ...effects, smoke_screen_until: smokeUntil },
      pending_notification: { type: 'smoke_screen', msgKey: 'smoke_screen_msg', params: {} },
      updated_at: new Date().toISOString(),
    }).eq('id', targetTeamId);

    return NextResponse.json({ ok: true });
  }

  // final_frenzy and "all" broadcasts
  const isBroadcast = type === 'final_frenzy' || targetTeamId === 'all';
  if (!isBroadcast && !targetTeamId) return NextResponse.json({ error: 'Missing targetTeamId.' }, { status: 400 });

  // Read powerups_used from games
  const { data: game, error: gameErr } = await supabase
    .from('games').select('powerups_used').eq('id', gameId).single();

  if (gameErr || !game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });

  const used: string[] = game.powerups_used ?? [];
  const usedKey = isBroadcast ? `${type}_all` : `${type}_${targetTeamId}`;

  if (used.includes(usedKey)) {
    return NextResponse.json({ error: 'Power-up already used.' }, { status: 409 });
  }

  // ── BROADCAST ────────────────────────────────────────────────────────────────
  if (isBroadcast) {
    const { data: allTeams, error: teamsErr } = await supabase
      .from('teams').select('id, score, active_effects').eq('game_id', gameId);

    if (teamsErr || !allTeams) return NextResponse.json({ error: 'Could not load teams.' }, { status: 500 });

    const notification = MSG_KEYS[type]
      ? { type, msgKey: MSG_KEYS[type], params: type === 'sabotage' ? { penalty: 100 } : {} }
      : { type, message: message ?? '' };

    const updates = allTeams.map(t => {
      const update: Record<string, unknown> = {
        id: t.id,
        pending_notification: notification,
        updated_at: new Date().toISOString(),
      };
      if (type === 'final_frenzy' || type === 'double_points') {
        update.double_points = true;
      }
      if (type === 'final_frenzy') {
        const effects = (t.active_effects as Record<string, unknown>) ?? {};
        update.active_effects = { ...effects, final_frenzy: true };
      }
      return update;
    });

    for (const upd of updates) {
      await supabase.from('teams').update(upd).eq('id', upd.id);
    }

    await supabase.from('games').update({
      powerups_used: [...used, usedKey],
      updated_at: new Date().toISOString(),
    }).eq('id', gameId);

    return NextResponse.json({ ok: true, usedKey, broadcast: true });
  }

  // ── SINGLE TEAM ──────────────────────────────────────────────────────────────
  const { data: team, error: teamErr } = await supabase
    .from('teams').select('score, active_effects').eq('id', targetTeamId).single();

  if (teamErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  const notification = type === 'fake_hint'
    ? { type, message: message.trim() }
    : MSG_KEYS[type]
      ? { type, msgKey: MSG_KEYS[type], params: {} }
      : { type, message: '' };

  const teamUpdate: Record<string, unknown> = {
    pending_notification: notification,
    updated_at: new Date().toISOString(),
  };

  if (type === 'double_points') teamUpdate.double_points = true;

  await supabase.from('teams').update(teamUpdate).eq('id', targetTeamId);

  await supabase.from('games').update({
    powerups_used: [...used, usedKey],
    updated_at: new Date().toISOString(),
  }).eq('id', gameId);

  return NextResponse.json({ ok: true, usedKey });
}
