// app/api/admin/custom-missions/category/route.ts
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

  const { category_name } = await req.json();
  if (!category_name?.trim()) return NextResponse.json({ error: 'Category name is required.' }, { status: 400 });

  const { error } = await getSupabase()
    .from('custom_missions')
    .update({ category_name: category_name.trim() })
    .eq('user_id', admin.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
