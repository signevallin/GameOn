// app/api/admin/mystery-box/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const body = await req.json();
  const { gameId, action } = body;
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const supabase = getSupabase();

  // ── EXPIRE ────────────────────────────────────────────────────────────────────
  if (action === 'expire') {
    const { data: game, error: gameLookupErr } = await supabase
      .from('games').select('mystery_box').eq('id', gameId).single();

    if (gameLookupErr || !game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    if (!game.mystery_box) return NextResponse.json({ ok: true, status: 'no_active' });

    const { error: expireErr } = await supabase.from('games').update({ mystery_box: null }).eq('id', gameId);
    if (expireErr) return NextResponse.json({ error: 'Failed to expire mystery box.' }, { status: 500 });

    const { data: allTeams } = await supabase
      .from('teams').select('id').eq('game_id', gameId);
    if (allTeams) {
      for (const t of allTeams) {
        await supabase.from('teams').update({
          pending_notification: {
            type: 'mystery_box_expired',
            msgKey: 'mystery_box_expired_msg',
            params: {},
          },
        }).eq('id', t.id);
      }
    }
    return NextResponse.json({ ok: true, status: 'expired' });
  }

  // ── CREATE ────────────────────────────────────────────────────────────────────
  const { data: game, error: gameErr } = await supabase
    .from('games').select('status, mystery_box').eq('id', gameId).single();

  if (gameErr || !game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
  if (game.status !== 'active') return NextResponse.json({ error: 'Game is not active.' }, { status: 400 });
  if (game.mystery_box) return NextResponse.json({ error: 'A mystery box is already active.' }, { status: 409 });

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 1000).toISOString();
  const mysteryBox = { created_at: now.toISOString(), expires_at: expiresAt, claimed_by: null };

  const { error: createErr } = await supabase.from('games').update({ mystery_box: mysteryBox }).eq('id', gameId);
  if (createErr) return NextResponse.json({ error: 'Failed to create mystery box.' }, { status: 500 });

  const { data: allTeams } = await supabase
    .from('teams').select('id').eq('game_id', gameId);
  if (allTeams) {
    for (const t of allTeams) {
      await supabase.from('teams').update({
        pending_notification: {
          type: 'mystery_box',
          msgKey: 'mystery_box_msg',
          params: { expiresAt },
        },
      }).eq('id', t.id);
    }
  }

  return NextResponse.json({ ok: true, expiresAt });
}
