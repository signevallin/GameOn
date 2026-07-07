// app/api/team/login/route.ts
import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { notifyGameUpdated } from '@/lib/realtime-server';
import { translateMission } from '@/lib/translate';
import { getEntitlements } from '@/lib/subscription';
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MEMBER_CAP = 20;

/**
 * Enforces the owner's plan team-cap for a game. Returns an error Response when
 * the cap is reached (only new teams are blocked; existing teams still join),
 * or null when a new team may be created.
 */
async function checkTeamCap(
  supabase: SupabaseClient,
  gameId: string,
  ownerId: string | null
): Promise<Response | null> {
  if (!ownerId) return null;
  const { maxTeams } = await getEntitlements(ownerId);
  if (maxTeams === Infinity) return null;

  const { count } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true })
    .eq('game_id', gameId);

  if ((count ?? 0) >= maxTeams) {
    return NextResponse.json(
      { error: `This game has reached the ${maxTeams}-team limit on the free plan. The organiser needs to upgrade to Pro.` },
      { status: 403 }
    );
  }
  return null;
}

export async function POST(req: Request) {
  // Throttle per IP to blunt game-key / join-code brute-forcing.
  const rl = rateLimit(`team-login:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { name, gameKey, joinCode, memberName } = await req.json();

  if (!name?.trim()) return NextResponse.json({ error: 'Enter a team name.' }, { status: 400 });
  if (!gameKey?.trim()) return NextResponse.json({ error: 'Enter a game key.' }, { status: 400 });

  // Find game
  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('*')
    .eq('game_key', gameKey.toUpperCase())
    .is('deleted_at', null)
    .single();

  if (gameErr || !game) return NextResponse.json({ error: 'Wrong game key. Ask the organiser.' }, { status: 404 });
  if (game.status === 'finished') return NextResponse.json({ error: 'This game is already finished.' }, { status: 400 });

  // Helper to build custom missions query (called inside each branch after validation)
  function buildCustomMissionsPromise() {
    if (!game.user_id) return Promise.resolve({ data: [] as unknown[] });
    const nowIso = new Date().toISOString();
    return supabase
      .from('custom_missions')
      .select('*, custom_mission_categories(name, emoji, color)')
      .eq('user_id', game.user_id)
      .is('deleted_at', null)
      .or(`active_from.is.null,active_from.lte.${nowIso}`)
      .or(`active_until.is.null,active_until.gte.${nowIso}`)
      .order('sort_order')
      .order('created_at');
  }

  // ── REMOTE MODE ──────────────────────────────────────────────────────────────
  if (game.remote_mode) {
    if (!memberName?.trim()) {
      return NextResponse.json({ error: 'Enter your name.' }, { status: 400 });
    }
    if (memberName.trim().length > 50) {
      return NextResponse.json({ error: 'Name too long (max 50 characters).' }, { status: 400 });
    }
    if (!joinCode?.trim()) {
      return NextResponse.json({ error: 'Enter the team code.' }, { status: 400 });
    }
    if (joinCode.trim().length !== 4) {
      return NextResponse.json({ error: 'Team code must be 4 characters.' }, { status: 400 });
    }

    const [teamResult, customMissionsResult] = await Promise.all([
      // Look up by join_code only — name typos must not create a duplicate team
      supabase
        .from('teams')
        .select('*')
        .eq('game_id', game.id)
        .eq('join_code', joinCode.trim().toUpperCase())
        .single(),
      buildCustomMissionsPromise(),
    ]);

    let customMissions = customMissionsResult.data ?? [];
    if (customMissions.length > 0 && game.language && game.language !== 'en') {
      customMissions = await Promise.all(
        customMissions.map(async (m: { id: string; name: string; desc: string; [key: string]: unknown }) => {
          const translated = await translateMission(m.id, game.language as string, m.name, m.desc ?? '', supabase);
          return { ...m, name: translated.name, desc: translated.desc };
        })
      );
    }

    let team = teamResult.data;

    if (!team) {
      // No team with that join_code yet — create one
      const capDenied = await checkTeamCap(supabase, game.id, game.user_id ?? null);
      if (capDenied) return capDenied;

      // Create new team with join_code
      const { data: newTeam, error: teamErr } = await supabase
        .from('teams')
        .insert({ name: name.trim(), game_id: game.id, score: 0, completed: [], join_code: joinCode.trim().toUpperCase() })
        .select()
        .single();

      if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });
      team = newTeam;
      await notifyGameUpdated(supabase, { gameId: game.id }, 'team-joined');
    }

    // Member cap check — best-effort (not transactional; acceptable for low-concurrency game use case)
    const { count: memberCount } = await supabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', team.id);

    if ((memberCount ?? 0) >= MEMBER_CAP) {
      return NextResponse.json({ error: 'Team is full.' }, { status: 409 });
    }

    // Create team_members row
    const { data: member, error: memberErr } = await supabase
      .from('team_members')
      .insert({ team_id: team.id, name: memberName.trim() })
      .select()
      .single();

    if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

    return NextResponse.json({
      team,
      memberId: member.id,
      memberName: member.name,
      game,
      customMissions,
    });
  }

  // ── CLASSIC MODE ─────────────────────────────────────────────────────────────
  const [teamResult, customMissionsResult] = await Promise.all([
    supabase.from('teams').select('*').ilike('name', name.trim()).eq('game_id', game.id).single(),
    buildCustomMissionsPromise(),
  ]);

  let customMissions = customMissionsResult.data ?? [];
  if (customMissions.length > 0 && game.language && game.language !== 'en') {
    customMissions = await Promise.all(
      customMissions.map(async (m: { id: string; name: string; desc: string; [key: string]: unknown }) => {
        const translated = await translateMission(m.id, game.language as string, m.name, m.desc ?? '', supabase);
        return { ...m, name: translated.name, desc: translated.desc };
      })
    );
  }

  if (teamResult.data) {
    return NextResponse.json({ team: teamResult.data, game, customMissions });
  }

  const capDenied = await checkTeamCap(supabase, game.id, game.user_id ?? null);
  if (capDenied) return capDenied;

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ name: name.trim(), game_id: game.id, score: 0, completed: [] })
    .select()
    .single();

  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });

  await notifyGameUpdated(supabase, { gameId: game.id }, 'team-joined');
  return NextResponse.json({ team, game, customMissions });
}
