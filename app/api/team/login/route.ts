import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { name, code } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Team name is required.' }, { status: 400 });
  }

  const expectedCode = process.env.TEAM_CODE ?? 'team123';
  if (code !== expectedCode) {
    return NextResponse.json({ error: 'Wrong team code. Try again.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('teams')
    .upsert({ name: name.trim() }, { onConflict: 'name', ignoreDuplicates: false })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ team: data });
}
