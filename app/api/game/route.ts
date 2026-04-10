import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key')?.toUpperCase();

  if (!key) return NextResponse.json({ error: 'Missing game key.' }, { status: 400 });

  // Games table has public read RLS policy — anon key is sufficient and
  // avoids a hard dependency on SUPABASE_SERVICE_ROLE_KEY for polling reads.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('game_key', key)
    .single();

  if (error || !data) return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
  return NextResponse.json({ game: data }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
