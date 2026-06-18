// app/api/admin/teams/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { ONLINE_THRESHOLD_MS } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type RawTeam = { id: string; join_code?: string | null; [key: string]: unknown };
type MemberRow = { name: string; last_seen_at: string };

async function enrichWithMembers(supabase: ReturnType<typeof getSupabase>, teams: RawTeam[]) {
  const remoteTeamIds = teams.filter(t => t.join_code).map(t => t.id);
  if (remoteTeamIds.length === 0) return teams;

  const { data: allMembers } = await supabase
    .from('team_members')
    .select('team_id, name, last_seen_at')
    .in('team_id', remoteTeamIds)
    .order('created_at', { ascending: true });

  if (!allMembers) return teams;

  const cutoff = Date.now() - ONLINE_THRESHOLD_MS;
  const membersByTeam = new Map<string, Array<{ name: string; online: boolean }>>();
  for (const m of allMembers as Array<{ team_id: string } & MemberRow>) {
    const list = membersByTeam.get(m.team_id) ?? [];
    list.push({ name: m.name, online: new Date(m.last_seen_at).getTime() > cutoff });
    membersByTeam.set(m.team_id, list);
  }

  return teams.map(t => t.join_code ? { ...t, members: membersByTeam.get(t.id) ?? [] } : t);
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { gameId } = await req.json();
  let query = getSupabase().from('teams').select('*').order('score', { ascending: false });
  if (gameId) query = query.eq('game_id', gameId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const teams = await enrichWithMembers(getSupabase(), (data ?? []) as RawTeam[]);
  return NextResponse.json({ teams });
}

export async function DELETE(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { teamId } = await req.json();
  if (!teamId) return NextResponse.json({ error: 'Missing teamId.' }, { status: 400 });

  const supabase = getSupabase();
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');
  let query = getSupabase().from('teams').select('*').order('score', { ascending: false });
  if (gameId) query = query.eq('game_id', gameId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const teams = await enrichWithMembers(getSupabase(), (data ?? []) as RawTeam[]);
  return NextResponse.json({ teams }, { headers: { 'Cache-Control': 'no-store, no-cache' } });
}
