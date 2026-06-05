// app/api/admin/game/[id]/report/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { renderToBuffer } from '@react-pdf/renderer';
import React from 'react';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { MISSIONS } from '@/lib/missions';
import { buildReport, ReportData, ReportPhoto } from '@/lib/pdf-report';

export const dynamic = 'force-dynamic';
// PDF rendering can take a few seconds — extend serverless timeout
export const maxDuration = 30;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function toBase64(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to fetch image at ${url}: ${res.status}`);
    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const supabase = getSupabase();

  // 1. Fetch game + verify ownership
  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('id, name, started_at, duration_minutes, user_id, status')
    .eq('id', params.id)
    .single();

  if (gameErr || !game) {
    return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
  }
  if (game.user_id !== admin.userId && !admin.isSuperAdmin) {
    return unauthorizedResponse();
  }

  // 2. Fetch teams sorted by score desc, then finished_at asc
  const { data: rawTeams, error: teamsErr } = await supabase
    .from('teams')
    .select('id, name, score, completed, mission_scores, finished_at')
    .eq('game_id', params.id);

  if (teamsErr) {
    console.error('[report] teams fetch error:', teamsErr);
    return NextResponse.json({ error: 'Failed to fetch teams.' }, { status: 500 });
  }

  const teams = (rawTeams ?? []).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const fa = a.finished_at ? new Date(a.finished_at).getTime() : Infinity;
    const fb = b.finished_at ? new Date(b.finished_at).getTime() : Infinity;
    return fa - fb;
  });

  // 3. Fetch top-rated photo per team (rated + points > 0, highest points_awarded wins)
  const teamIds = teams.map(t => t.id);
  const { data: allPhotos } = teamIds.length > 0
    ? await supabase
        .from('photo_submissions')
        .select('team_id, team_name, photo_url, points_awarded')
        .in('team_id', teamIds)
        .eq('status', 'rated')
        .gt('points_awarded', 0)
        .order('points_awarded', { ascending: false })
    : { data: [] };

  // De-duplicate: one per team (already ordered by points desc, so first wins)
  const seen = new Set<string>();
  const topPhotos = (allPhotos ?? []).filter(p => {
    if (seen.has(p.team_id)) return false;
    seen.add(p.team_id);
    return true;
  });

  // 4. Fetch custom missions for this game's owner
  const { data: customMissionRows } = game.user_id
    ? await supabase
        .from('custom_missions')
        .select('id, name, icon')
        .eq('user_id', game.user_id)
    : { data: [] };

  // 5. Build missionMap (static + custom)
  const missionMap: ReportData['missionMap'] = {};
  for (const m of MISSIONS) {
    missionMap[m.id] = { name: m.name, icon: m.icon };
  }
  for (const m of (customMissionRows ?? [])) {
    missionMap[m.id] = { name: m.name, icon: m.icon };
  }

  // 6. Convert photos to base64 in parallel (skip failures)
  const teamOrder = new Map(teams.map((t, i) => [t.id, i]));
  const photoResults = await Promise.allSettled(
    topPhotos.map(async p => {
      const base64 = await toBase64(p.photo_url);
      return {
        teamName: p.team_name as string,
        base64,
        pointsAwarded: p.points_awarded as number,
        order: teamOrder.get(p.team_id) ?? 999,
      };
    })
  );

  const reportPhotos: ReportPhoto[] = photoResults
    .filter((r): r is PromiseFulfilledResult<ReportPhoto & { order: number }> => r.status === 'fulfilled')
    .map(r => r.value)
    .sort((a, b) => a.order - b.order)
    .map(({ teamName, base64, pointsAwarded }) => ({ teamName, base64, pointsAwarded }));

  // 6b. Compute per-mission stats from teams data
  const missionStats: Record<string, { completed: number; totalScore: number; topScore: number }> = {};
  for (const team of teams) {
    for (const mId of (team.completed ?? [])) {
      const pts = (team.mission_scores ?? {})[mId] ?? 0;
      if (!missionStats[mId]) missionStats[mId] = { completed: 0, totalScore: 0, topScore: 0 };
      missionStats[mId].completed += 1;
      missionStats[mId].totalScore += pts;
      if (pts > missionStats[mId].topScore) missionStats[mId].topScore = pts;
    }
  }

  // 7. Render PDF
  const data: ReportData = {
    game: {
      name: game.name,
      started_at: game.started_at ?? new Date().toISOString(),
      duration_minutes: game.duration_minutes,
    },
    teams,
    photos: reportPhotos,
    missionMap,
    teamCount: teams.length,
    missionStats,
  };

  let buffer: Buffer;
  try {
    buffer = await renderToBuffer(buildReport(data));
  } catch (err) {
    console.error('[report] PDF render error:', err);
    return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 });
  }

  const slug = game.name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase() || 'report';

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slug}-report.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}
