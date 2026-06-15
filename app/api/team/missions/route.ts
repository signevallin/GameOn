import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const supabase = getSupabase();

  const { data: game } = await supabase
    .from('games')
    .select('user_id')
    .eq('id', gameId)
    .is('deleted_at', null)
    .single();

  if (!game?.user_id) return NextResponse.json({ customMissions: [] });

  const nowIso = new Date().toISOString();
  const { data: customMissions } = await supabase
    .from('custom_missions')
    .select('*, custom_mission_categories(name, emoji, color)')
    .eq('user_id', game.user_id)
    .is('deleted_at', null)
    .or(`active_from.is.null,active_from.lte.${nowIso}`)
    .or(`active_until.is.null,active_until.gte.${nowIso}`)
    .order('sort_order')
    .order('created_at');

  return NextResponse.json({ customMissions: customMissions ?? [] });
}
