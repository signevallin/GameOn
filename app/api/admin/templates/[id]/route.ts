// app/api/admin/templates/[id]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { toGameTemplate } from '@/lib/templates';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const db = adminClient();
  const { data: existing, error: fetchErr } = await db
    .from('game_templates')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.is_builtin && !admin.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!existing.is_builtin && existing.user_id !== admin.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.icon !== undefined) updates.icon = body.icon;
  if (body.description !== undefined) updates.description = body.description;
  if (body.missionIds !== undefined) updates.mission_ids = body.missionIds;

  const { data, error } = await db
    .from('game_templates')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: toGameTemplate(data) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await validateAdminToken(_req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const db = adminClient();
  const { data: existing, error: fetchErr } = await db
    .from('game_templates')
    .select('id, is_builtin, user_id')
    .eq('id', params.id)
    .single();

  if (fetchErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.is_builtin && !admin.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!existing.is_builtin && existing.user_id !== admin.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await db.from('game_templates').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
