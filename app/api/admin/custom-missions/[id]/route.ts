// app/api/admin/custom-missions/[id]/route.ts
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

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { id } = params;
  const body = await req.json();

  // Verify ownership
  const { data: existing } = await getSupabase()
    .from('custom_missions').select('user_id').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (existing.user_id !== admin.userId && !admin.isSuperAdmin) return unauthorizedResponse();

  const { name, icon, desc, difficulty, max_pts, type, data, sort_order } = body;

  const { data: mission, error } = await getSupabase()
    .from('custom_missions')
    .update({
      name: name?.trim(),
      icon,
      desc,
      difficulty,
      max_pts,
      type,
      data,
      sort_order,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mission });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { id } = params;

  // Verify ownership
  const { data: existing } = await getSupabase()
    .from('custom_missions').select('user_id').eq('id', id).single();
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (existing.user_id !== admin.userId && !admin.isSuperAdmin) return unauthorizedResponse();

  const { error } = await getSupabase().from('custom_missions').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
