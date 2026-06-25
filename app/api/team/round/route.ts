// app/api/team/round/route.ts
// Lightweight round-index persistence for multi-round missions in remote mode.
// Stored in relay_state under key "__round_<missionId>" to avoid conflicts.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function stateKey(missionId: string) {
  return `__round_${missionId}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const missionId = searchParams.get('missionId');

  if (!teamId || !missionId) {
    return NextResponse.json({ qIdx: 0 });
  }

  const supabase = getSupabase();
  const { data: team } = await supabase
    .from('teams')
    .select('relay_state')
    .eq('id', teamId)
    .single();

  if (!team) return NextResponse.json({ qIdx: 0 });

  const existing = (team.relay_state as Record<string, unknown> | null) ?? {};
  const entry = existing[stateKey(missionId)] as { qIdx?: number } | undefined;
  return NextResponse.json({ qIdx: entry?.qIdx ?? 0 });
}

export async function POST(req: Request) {
  let body: { teamId?: unknown; missionId?: unknown; qIdx?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const { teamId, missionId, qIdx } = body;
  if (typeof teamId !== 'string' || typeof missionId !== 'string' || typeof qIdx !== 'number') {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: team } = await supabase.from('teams').select('relay_state').eq('id', teamId).single();
  if (!team) return NextResponse.json({ ok: false }, { status: 404 });

  const existing = (team.relay_state as Record<string, unknown> | null) ?? {};
  const updated = { ...existing, [stateKey(missionId)]: { qIdx } };
  await supabase.from('teams').update({ relay_state: updated }).eq('id', teamId);

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const missionId = searchParams.get('missionId');

  if (!teamId || !missionId) return NextResponse.json({ ok: true });

  const supabase = getSupabase();
  const { data: team } = await supabase.from('teams').select('relay_state').eq('id', teamId).single();
  if (!team) return NextResponse.json({ ok: true });

  const existing = (team.relay_state as Record<string, unknown> | null) ?? {};
  const updated = { ...existing };
  delete updated[stateKey(missionId)];
  await supabase.from('teams').update({ relay_state: updated }).eq('id', teamId);

  return NextResponse.json({ ok: true });
}
