// app/api/team/relay/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const missionId = searchParams.get('missionId');

  if (!teamId || !missionId) {
    return NextResponse.json({ error: 'Missing teamId or missionId.' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: team, error: fetchErr } = await supabase
    .from('teams')
    .select('relay_state')
    .eq('id', teamId)
    .single();

  if (fetchErr || !team) return NextResponse.json({ ok: true });

  const existing = (team.relay_state as Record<string, unknown> | null) ?? {};
  const updated = { ...existing };
  delete updated[missionId];

  await supabase.from('teams').update({ relay_state: updated }).eq('id', teamId);

  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  const missionId = searchParams.get('missionId');

  if (!teamId || !missionId) {
    return NextResponse.json({ error: 'Missing teamId or missionId.' }, { status: 400 });
  }

  const supabase = getSupabase();
  const { data: team, error } = await supabase
    .from('teams')
    .select('relay_state')
    .eq('id', teamId)
    .single();

  if (error || !team) {
    return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  }

  const existing = (team.relay_state as Record<string, unknown> | null) ?? {};
  const missionState = existing[missionId] ?? null;

  return NextResponse.json({ relayState: missionState });
}

export async function POST(req: Request) {
  let body: { teamId?: unknown; missionId?: unknown; action?: unknown; elapsedMs?: unknown; segmentCount?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { teamId, missionId, action, elapsedMs, segmentCount } = body;

  if (!teamId || typeof teamId !== 'string') {
    return NextResponse.json({ error: 'Missing teamId.' }, { status: 400 });
  }
  if (!missionId || typeof missionId !== 'string') {
    return NextResponse.json({ error: 'Missing missionId.' }, { status: 400 });
  }
  if (action !== 'advance' && action !== 'skip') {
    return NextResponse.json({ error: 'action must be "advance" or "skip".' }, { status: 400 });
  }

  const supabase = getSupabase();

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('id, relay_state')
    .eq('id', teamId)
    .single();

  if (teamErr || !team) {
    return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const existing = (team.relay_state as Record<string, unknown> | null) ?? {};
  const missionState = (existing[missionId] as {
    activeIndex: number;
    startedAt: string;
    segments: { completedAt?: string; elapsedMs?: number; skipped?: boolean }[];
  } | undefined) ?? {
    activeIndex: 0,
    startedAt: now,
    segments: [],
  };

  const segmentRecord =
    action === 'advance'
      ? { completedAt: now, elapsedMs: typeof elapsedMs === 'number' ? elapsedMs : 0 }
      : { skipped: true, completedAt: now, elapsedMs: 0 };

  const newSegments = [...missionState.segments, segmentRecord];
  const newActiveIndex = missionState.activeIndex + 1;

  const newMissionState = {
    ...missionState,
    activeIndex: newActiveIndex,
    segments: newSegments,
  };

  const newRelayState = { ...existing, [missionId]: newMissionState };

  const { error: updateErr } = await supabase
    .from('teams')
    .update({ relay_state: newRelayState })
    .eq('id', teamId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const complete =
    typeof segmentCount === 'number' ? newActiveIndex >= segmentCount : false;

  return NextResponse.json({ relayState: newMissionState, complete });
}
