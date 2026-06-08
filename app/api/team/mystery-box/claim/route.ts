// app/api/team/mystery-box/claim/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const POWERUP_POOL = [
  'shield', 'freeze', 'double_trouble', 'all_in', 'point_steal', 'robin_hood',
] as const;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { teamId } = body ?? {};
  if (!teamId) return NextResponse.json({ error: 'Missing teamId.' }, { status: 400 });

  const supabase = getSupabase();

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('id, name, game_id, extra_powerups')
    .eq('id', teamId)
    .single();
  if (teamErr || !team) return NextResponse.json({ error: 'Team not found.' }, { status: 404 });

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('mystery_box')
    .eq('id', team.game_id)
    .single();
  if (gameErr || !game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });

  const mb = game.mystery_box as {
    created_at: string;
    expires_at: string;
    claimed_by: string | null;
  } | null;

  if (!mb) {
    return NextResponse.json({ error: 'No active mystery box.', code: 'expired' }, { status: 409 });
  }
  if (new Date() > new Date(mb.expires_at)) {
    return NextResponse.json({ error: 'Mystery box expired.', code: 'expired' }, { status: 409 });
  }
  if (mb.claimed_by !== null) {
    return NextResponse.json({ error: 'Already claimed.', code: 'already_claimed' }, { status: 409 });
  }

  // Assign random power-up
  const powerup = POWERUP_POOL[Math.floor(Math.random() * POWERUP_POOL.length)];

  // Atomic claim: only update if claimed_by is still null (race condition guard)
  const { count, error: claimErr } = await supabase
    .from('games')
    .update({
      mystery_box: { ...mb, claimed_by: teamId },
      updated_at: new Date().toISOString(),
    }, { count: 'exact' })
    .eq('id', team.game_id)
    .filter('mystery_box->>claimed_by', 'is', null);

  if (claimErr) return NextResponse.json({ error: 'Failed to claim mystery box.' }, { status: 500 });
  if (!count || count === 0) {
    return NextResponse.json({ error: 'Already claimed.', code: 'already_claimed' }, { status: 409 });
  }

  // Grant power-up to winning team
  const extraPowerups: string[] = team.extra_powerups ?? [];
  const { error: teamUpdateErr } = await supabase.from('teams').update({
    extra_powerups: [...extraPowerups, powerup],
    pending_notification: {
      type: 'mystery_box_won',
      msgKey: 'mystery_box_won_msg',
      params: { powerup },
    },
  }).eq('id', teamId);

  if (teamUpdateErr) return NextResponse.json({ error: 'Failed to update team.' }, { status: 500 });

  // Notify all other teams (best-effort, fire-and-forget)
  const { data: allTeams } = await supabase
    .from('teams').select('id').eq('game_id', team.game_id).neq('id', teamId);
  if (allTeams) {
    await Promise.all(allTeams.map((t) =>
      supabase.from('teams').update({
        pending_notification: {
          type: 'mystery_box_taken',
          msgKey: 'mystery_box_taken_msg',
          params: { team: team.name },
        },
      }).eq('id', t.id)
    ));
  }

  return NextResponse.json({ ok: true, powerup });
}
