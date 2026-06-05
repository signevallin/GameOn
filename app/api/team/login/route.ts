// app/api/team/login/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { name, gameKey } = await req.json();

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
  const [teamResult, customMissionsResult] = await Promise.all([
    supabase.from('teams').select('*').eq('name', name.trim()).eq('game_id', game.id).single(),
    game.user_id
      ? supabase.from('custom_missions').select('*').eq('user_id', game.user_id).order('sort_order').order('created_at')
      : Promise.resolve({ data: [] }),
  ]);

  const customMissions = customMissionsResult.data ?? [];

  if (teamResult.data) {
    // Team already exists — return as-is (preserve score and completed missions)
    return NextResponse.json({ team: teamResult.data, game, customMissions });
  }

  // ── Enforce free-plan team limit ──────────────────────────────────────────
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

  // New team — create it
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ name: name.trim(), game_id: game.id, score: 0, completed: [] })
    .select()
    .single();

  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });

  return NextResponse.json({ team, game, customMissions });
}
