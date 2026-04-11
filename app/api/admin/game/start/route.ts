import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { gameId, action } = await req.json();
  if (!gameId) return NextResponse.json({ error: 'Missing gameId.' }, { status: 400 });

  const updates =
    action === 'finish'
      ? { status: 'finished' }
      : action === 'restart'
      ? { status: 'draft', started_at: null }
      : { status: 'active', started_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('games')
    .update(updates)
    .eq('id', gameId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // On restart, clear power-up usage tracking so they can be used in the new game
  if (action === 'restart') {
    await supabase
      .from('settings')
      .update({ powerups_used: [], updated_at: new Date().toISOString() })
      .eq('id', 1);
  }

  return NextResponse.json({ game: data });
}
