import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const teamId = searchParams.get('teamId');
  if (!teamId) return NextResponse.json({ error: 'Missing teamId.' }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('[/api/team/status] Missing env vars:', { url: !!url, serviceKey: !!serviceKey });
    return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
  }

  const supabase = createClient(url, serviceKey);

  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();

  if (error) {
    console.error('[/api/team/status] Supabase error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ team: data }, { headers: { 'Cache-Control': 'no-store' } });
}
