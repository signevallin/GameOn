import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { visible_missions } = await req.json();

  if (!Array.isArray(visible_missions)) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
  }

  const { error, data } = await supabase
    .from('settings')
    .upsert({ id: 1, visible_missions, updated_at: new Date().toISOString() })
    .select();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: 'No rows updated – check Supabase RLS.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
