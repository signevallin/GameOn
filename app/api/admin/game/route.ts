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

/** Normalize the Supabase teams(count) join into a flat teams_count number.
 *  For soft-deleted games the teams rows are gone, so we fall back to the
 *  stored teams_count snapshot on the game row itself. */
function normalizeTeamsCount(g: Record<string, unknown>): number {
  if (g.deleted_at) return (g.teams_count as number | null) ?? 0;
  return (g.teams as { count: number }[] | null)?.[0]?.count ?? 0;
}

async function fetchGamesList(admin: { isSuperAdmin: boolean; userId: string }, includeDeleted: boolean) {
  let query = adminClient().from('games').select('*, teams(count)').order('created_at', { ascending: false });
  if (!admin.isSuperAdmin) query = query.eq('user_id', admin.userId);
  if (!includeDeleted) query = query.is('deleted_at', null);
  const { data, error } = await query;
  if (error) return { error: error.message };
  const games = (data ?? []).map(g => ({
    ...g,
    teams_count: normalizeTeamsCount(g as Record<string, unknown>),
    teams: undefined,
  }));
  return { games };
}

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();
  const url = new URL(req.url);
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
  const result = await fetchGamesList(admin, includeDeleted);
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ games: result.games }, { headers: { 'Cache-Control': 'no-store, no-cache' } });
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const body = await req.json();

  if (body.action === 'list') {
    const result = await fetchGamesList(admin, body.includeDeleted === true);
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json({ games: result.games });
  }

  if (body.action === 'delete') {
    const { gameId } = body;
    if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

    const db = adminClient();

    // Verify ownership (only non-deleted games)
    const { data: game } = await db.from('games').select('user_id').eq('id', gameId).is('deleted_at', null).single();
    if (!game) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
    if (!admin.isSuperAdmin && game.user_id !== admin.userId) return unauthorizedResponse();

    // Snapshot team count before deleting teams
    const { count: teamsCount } = await db
      .from('teams')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId);

    // Soft-delete the game (preserve row for analytics)
    const { error: softDeleteErr } = await db
      .from('games')
      .update({ deleted_at: new Date().toISOString(), teams_count: teamsCount ?? 0 })
      .eq('id', gameId);
    if (softDeleteErr) return NextResponse.json({ error: softDeleteErr.message }, { status: 500 });

    // Hard-delete teams and photos (data no longer needed)
    const { data: gameTeams } = await db.from('teams').select('id').eq('game_id', gameId);
    const teamIds = (gameTeams ?? []).map((t: { id: string }) => t.id);
    if (teamIds.length) {
      await db.from('photo_submissions').delete().in('team_id', teamIds);
    }
    await db.from('teams').delete().eq('game_id', gameId);

    return NextResponse.json({ ok: true });
  }

  // Create game
  const { name, missions, duration_minutes, mission_max_pts, hide_leaderboard, ai_photo_rating, ai_photo_instructions, language, remote_mode, brand_logo_url, brand_primary_color, brand_name } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'Enter a game name.' }, { status: 400 });
  if (!missions?.length) return NextResponse.json({ error: 'Select at least one mission.' }, { status: 400 });

  let key = '';
  let attempts = 0;
  while (attempts < 10) {
    key = generateKey();
    const { data: existing } = await adminClient().from('games').select('id').eq('game_key', key).single();
    if (!existing) break;
    attempts++;
  }

  const { data: newGame, error } = await adminClient()
    .from('games')
    .insert({
      game_key: key,
      name: name.trim(),
      missions,
      duration_minutes: duration_minutes ?? 45,
      mission_max_pts: mission_max_pts ?? {},
      hide_leaderboard: hide_leaderboard ?? false,
      ai_photo_rating: ai_photo_rating ?? false,
      ai_photo_instructions: ai_photo_instructions ?? null,
      language: language ?? 'en',
      status: 'draft',
      user_id: admin.userId,
      powerups_used: [],
      remote_mode: remote_mode ?? false,
      brand_logo_url: brand_logo_url ?? null,
      brand_primary_color: brand_primary_color ?? null,
      brand_name: brand_name ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ game: newGame });
}
