import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET – kept for compatibility
export async function GET() {
  const { data, error } = await getSupabase()
    .from('settings')
    .select('visible_missions, powerups_used')
    .eq('id', 1)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ visible_missions: data.visible_missions, powerups_used: data.powerups_used ?? [] });
}

// POST – used by admin polling (POST is never cached by Vercel edge)
export async function POST() {
  const { data, error } = await getSupabase()
    .from('settings')
    .select('visible_missions, powerups_used')
    .eq('id', 1)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ visible_missions: data.visible_missions, powerups_used: data.powerups_used ?? [] });
}
