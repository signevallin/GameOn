import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key')?.toUpperCase();

  if (!key) return NextResponse.json({ error: 'Missing game key.' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('[/api/game] Missing env vars:', { url: !!url, serviceKey: !!serviceKey });
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
  }

  const supabase = createClient(url, serviceKey);

  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('game_key', key)
    .single();

  if (error || !data) {
    console.error('[/api/game] Supabase error:', error?.message);
    return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
  }

  return NextResponse.json({ game: data }, { headers: { 'Cache-Control': 'no-store' } });
}
