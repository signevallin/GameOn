// app/api/admin/game/start/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { gameId, action } = await req.json();
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const updates =
    action === 'finish'
      ? { status: 'finished' }
      : action === 'restart'
      ? { status: 'draft', started_at: null }
      : { status: 'active', started_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('games')
    .update(updates)
    .eq('id', gameId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // On restart: clear powerup state on the game row and reset team effects
  if (action === 'restart') {
    await supabase.from('games').update({
      powerups_used: [],
      hot_potato: null,
      updated_at: new Date().toISOString(),
    }).eq('id', gameId);

    await supabase.from('teams').update({
      active_effects: {},
      double_points: false,
      updated_at: new Date().toISOString(),
    }).eq('game_id', gameId);
  }

  return NextResponse.json({ game: data });
}
