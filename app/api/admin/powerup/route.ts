import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MESSAGES: Record<string, string> = {
  sabotage: '💥 SABOTAGE! -100 points deducted from your team',
  double_points: '🎉 POWER-UP! Double points on your next mission!',
};

export async function POST(req: Request) {
  const { type, targetTeamId, message } = await req.json();

  if (!type || !targetTeamId) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }
  if (!['sabotage', 'double_points', 'fake_hint'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type.' }, { status: 400 });
  }
  if (type === 'fake_hint' && !message?.trim()) {
    return NextResponse.json({ error: 'Message required for fake_hint.' }, { status: 400 });
  }

  const supabase = getSupabase();
  const usedKey = `${type}_${targetTeamId}`;

  // Check powerups_used
  const { data: settings, error: settingsErr } = await supabase
    .from('settings')
    .select('powerups_used')
    .eq('id', 1)
    .single();

  if (settingsErr || !settings) {
    return NextResponse.json({ error: 'Could not load settings.' }, { status: 500 });
  }

  const used: string[] = settings.powerups_used ?? [];
  if (used.includes(usedKey)) {
    return NextResponse.json({ error: 'Power-up already used.' }, { status: 409 });
  }

  // Fetch current team score (needed for sabotage)
  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .select('score')
    .eq('id', targetTeamId)
    .single();

  if (teamErr || !team) {
    return NextResponse.json({ error: 'Team not found.' }, { status: 404 });
  }

  // Build the team update
  const notification = {
    type,
    message: type === 'fake_hint' ? message.trim() : MESSAGES[type],
  };

  const teamUpdate: Record<string, unknown> = {
    pending_notification: notification,
    updated_at: new Date().toISOString(),
  };

  if (type === 'sabotage') {
    teamUpdate.score = Math.max(0, (team.score ?? 0) - 100);
  }
  if (type === 'double_points') {
    teamUpdate.double_points = true;
  }

  const { error: updateErr } = await supabase
    .from('teams')
    .update(teamUpdate)
    .eq('id', targetTeamId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Mark power-up as used
  const { error: settingsUpdateErr } = await supabase
    .from('settings')
    .update({ powerups_used: [...used, usedKey], updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (settingsUpdateErr) {
    return NextResponse.json({ error: settingsUpdateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, usedKey });
}