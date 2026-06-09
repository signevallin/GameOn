// app/api/team/login/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { translateMission } from '@/lib/translate';

export const dynamic = 'force-dynamic';

const MEMBER_CAP = 20;

export async function POST(req: Request) {
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
    .single();

  if (gameErr || !game) return NextResponse.json({ error: 'Wrong game key. Ask the organiser.' }, { status: 404 });
  if (game.status === 'finished') return NextResponse.json({ error: 'This game is already finished.' }, { status: 400 });

  // Fetch custom missions for this game's owner (in parallel with team lookup)
  const customMissionsPromise = game.user_id
    ? (() => {
        const nowIso = new Date().toISOString();
        return supabase
          .from('custom_missions')
          .select('*')
          .eq('user_id', game.user_id)
          .or(`active_from.is.null,active_from.lte.${nowIso}`)
          .or(`active_until.is.null,active_until.gte.${nowIso}`)
          .order('sort_order')
          .order('created_at');
      })()
    : Promise.resolve({ data: [] });

  // ── REMOTE MODE ──────────────────────────────────────────────────────────────
  if (game.remote_mode) {
    if (!memberName?.trim()) {
      return NextResponse.json({ error: 'Enter your name.' }, { status: 400 });
    }
    if (!joinCode?.trim()) {
      return NextResponse.json({ error: 'Enter the team code.' }, { status: 400 });
    }

    const [teamResult, customMissionsResult] = await Promise.all([
      supabase
        .from('teams')
        .select('*')
        .eq('game_id', game.id)
        .eq('name', name.trim())
        .eq('join_code', joinCode.trim().toUpperCase())
        .single(),
      customMissionsPromise,
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
      // Team name + code combo not found — could mean name/code mismatch on existing team,
      // or brand new team. Check if a team with that name already exists (wrong code).
      const { data: existingByName } = await supabase
        .from('teams')
        .select('id')
        .eq('game_id', game.id)
        .eq('name', name.trim())
        .single();

      if (existingByName) {
        // Team name exists but join_code doesn't match
        return NextResponse.json(
          { error: "Team code or name doesn't match. Check with your team." },
          { status: 404 }
        );
      }

      // ── Enforce free-plan team limit ────────────────────────────────────────
      if (game.user_id) {
        const { getSubscription } = await import('@/lib/subscription');
        const sub = await getSubscription(game.user_id);
        if (sub.plan === 'free') {
          const { count } = await supabase
            .from('teams')
            .select('id', { count: 'exact', head: true })
            .eq('game_id', game.id);
          if ((count ?? 0) >= 5) {
            return NextResponse.json(
              { error: 'This game has reached the 5-team limit on the free plan. The organiser needs to upgrade to Pro.' },
              { status: 403 }
            );
          }
        }
      }

      // Create new team with join_code
      const { data: newTeam, error: teamErr } = await supabase
        .from('teams')
        .insert({ name: name.trim(), game_id: game.id, score: 0, completed: [], join_code: joinCode.trim().toUpperCase() })
        .select()
        .single();

      if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });
      team = newTeam;
    }

    // Check member cap
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

  // ── CLASSIC MODE (unchanged) ─────────────────────────────────────────────────
  const [teamResult, customMissionsResult] = await Promise.all([
    supabase.from('teams').select('*').eq('name', name.trim()).eq('game_id', game.id).single(),
    customMissionsPromise,
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

  // ── Enforce free-plan team limit ────────────────────────────────────────────
  if (game.user_id) {
    const { getSubscription } = await import('@/lib/subscription');
    const sub = await getSubscription(game.user_id);
    if (sub.plan === 'free') {
      const { count } = await supabase
        .from('teams')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', game.id);
      if ((count ?? 0) >= 5) {
        return NextResponse.json(
          { error: 'This game has reached the 5-team limit on the free plan. The organiser needs to upgrade to Pro.' },
          { status: 403 }
        );
      }
    }
  }

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ name: name.trim(), game_id: game.id, score: 0, completed: [] })
    .select()
    .single();

  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });

  return NextResponse.json({ team, game, customMissions });
}
