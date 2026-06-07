// app/api/admin/game/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function generateKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';
  for (let i = 0; i < 6; i++) key += chars[Math.floor(Math.random() * chars.length)];
  return key;
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  let query = adminClient().from('games').select('*').order('created_at', { ascending: false });
  if (!admin.isSuperAdmin) query = query.eq('user_id', admin.userId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ games: data }, { headers: { 'Cache-Control': 'no-store, no-cache' } });
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const body = await req.json();

  if (body.action === 'list') {
    let query = adminClient().from('games').select('*').order('created_at', { ascending: false });
    if (!admin.isSuperAdmin) query = query.eq('user_id', admin.userId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ games: data });
  }

  if (body.action === 'delete') {
    const { gameId } = body;
    if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

    // Verify ownership
    const { data: game } = await adminClient().from('games').select('user_id').eq('id', gameId).single();
    if (!game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    if (!admin.isSuperAdmin && game.user_id !== admin.userId) return unauthorizedResponse();

    const { data: gameTeams } = await adminClient().from('teams').select('id').eq('game_id', gameId);
    const teamIds = (gameTeams ?? []).map((t: { id: string }) => t.id);
    if (teamIds.length) {
      await adminClient().from('photo_submissions').delete().in('team_id', teamIds);
    }
    await adminClient().from('teams').delete().eq('game_id', gameId);
    const { error } = await adminClient().from('games').delete().eq('id', gameId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Create game
  const { name, missions, duration_minutes, mission_max_pts, hide_leaderboard, ai_photo_rating, ai_photo_instructions } = body;
  if (!missions?.length) return NextResponse.json({ error: 'Select at least one mission.' }, { status: 400 });

  let key = '';
  let attempts = 0;
  while (attempts < 10) {
    key = generateKey();
    const { data: existing } = await adminClient().from('games').select('id').eq('game_key', key).single();
    if (!existing) break;
    attempts++;
  }

  const { data: game, error } = await adminClient()
    .from('games')
    .insert({
      game_key: key,
      name: name?.trim() || null,
      missions,
      duration_minutes: duration_minutes ?? 45,
      mission_max_pts: mission_max_pts ?? {},
      hide_leaderboard: hide_leaderboard ?? false,
      ai_photo_rating: ai_photo_rating ?? false,
      ai_photo_instructions: ai_photo_instructions ?? null,
      status: 'draft',
      user_id: admin.userId,
      powerups_used: [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ game });
}
