import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST – team marks themselves as done
export async function POST(req: Request) {
  const { teamId } = await req.json();
  if (!teamId) return NextResponse.json({ error: 'Missing teamId.' }, { status: 400 });

  // Only set finished_at once (never overwrite)
  const { data, error } = await getSupabase()
    .from('teams')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', teamId)
    .is('finished_at', null)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ team: data });
}
