// app/api/settings/route.ts
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

  const { gameId } = await req.json();
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const { data, error } = await getSupabase()
    .from('games')
    .select('powerups_used, hot_potato')
    .eq('id', gameId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });

  return NextResponse.json({
    powerups_used: data.powerups_used ?? [],
    hot_potato: data.hot_potato ?? null,
  });
}

// GET kept for compatibility — requires gameId as query param
export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get('gameId');
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const { data, error } = await getSupabase()
    .from('games')
    .select('powerups_used, hot_potato')
    .eq('id', gameId)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });

  return NextResponse.json({
    powerups_used: data.powerups_used ?? [],
    hot_potato: data.hot_potato ?? null,
  });
}
