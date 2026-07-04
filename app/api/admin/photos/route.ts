import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse, requireGameOwnership } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function listForGame(req: Request, gameId: string | null) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const supabase = getSupabase();
  const denied = await requireGameOwnership(supabase, admin, gameId);
  if (denied) return denied;

  const { data: teams, error: teamsErr } = await supabase
    .from('teams').select('id').eq('game_id', gameId);
  if (teamsErr) return NextResponse.json({ error: teamsErr.message }, { status: 500 });

  const teamIds = (teams ?? []).map(t => t.id);
  if (teamIds.length === 0) {
    return NextResponse.json({ submissions: [] }, { headers: { 'Cache-Control': 'no-store, no-cache' } });
  }

  const { data, error } = await supabase
    .from('photo_submissions')
    .select('*')
    .in('team_id', teamIds)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submissions: data }, { headers: { 'Cache-Control': 'no-store, no-cache' } });
}

// POST – used by admin polling (POST is never cached by Vercel edge)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return listForGame(req, body?.gameId ?? null);
}

// GET – kept for compatibility
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  return listForGame(req, searchParams.get('gameId'));
}
