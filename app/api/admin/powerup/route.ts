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

const MESSAGES: Record<string, string> = {
  sabotage: '💻 YOU HAVE BEEN HACKED! -100 points deducted from your team',
  double_points: '🎯 POWER-UP! Double points on your next mission!',
  final_frenzy: '🔥 FINAL FRENZY ACTIVATED! All points are now doubled!',
};

const VALID_TYPES = ['sabotage', 'double_points', 'fake_hint', 'final_frenzy', 'hot_potato'];

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
            message: `💣 TIME BOMB! Complete '${missionLabel}' within 3 minutes or lose 500 points!`,
          },
          updated_at: new Date().toISOString(),
        }).eq('id', t.id);
      }
    }

    return NextResponse.json({ ok: true, expiresAt });
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
      if (type === 'final_frenzy') {
        const effects = (t.active_effects as Record<string, unknown>) ?? {};
        update.active_effects = { ...effects, final_frenzy: true };
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

  await supabase.from('teams').update(teamUpdate).eq('id', targetTeamId);

  await supabase.from('games').update({
    powerups_used: [...used, usedKey],
    updated_at: new Date().toISOString(),
  }).eq('id', gameId);

  return NextResponse.json({ ok: true, usedKey });
}
