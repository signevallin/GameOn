// app/api/admin/custom-missions/[id]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { parseActiveWindow } from '@/lib/parse-active-window';

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

  const { category_id, name, icon, desc, difficulty, max_pts, type, data, sort_order, active_from, active_until } = body;

  if (name !== undefined && !name?.trim()) return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 });

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (category_id && (typeof category_id !== 'string' || !UUID_RE.test(category_id))) {
    return NextResponse.json({ error: 'Invalid category_id.' }, { status: 400 });
  }

  let activeFromParsed: { value: string | null } | null = null;
  if (active_from !== undefined) {
    const r = parseActiveWindow(active_from);
    if (!r.ok) return NextResponse.json({ error: 'Invalid active_from.' }, { status: 400 });
    activeFromParsed = { value: r.value };
  }
  let activeUntilParsed: { value: string | null } | null = null;
  if (active_until !== undefined) {
    const r = parseActiveWindow(active_until);
    if (!r.ok) return NextResponse.json({ error: 'Invalid active_until.' }, { status: 400 });
    activeUntilParsed = { value: r.value };
  }

  // Only include fields that were explicitly provided
  const updateFields: Record<string, unknown> = {};
  if (name !== undefined) updateFields.name = name.trim();
  if (icon !== undefined) updateFields.icon = icon;
  if (desc !== undefined) updateFields.desc = desc;
  if (difficulty !== undefined) updateFields.difficulty = difficulty;
  if (max_pts !== undefined) updateFields.max_pts = max_pts;
  if (type !== undefined) updateFields.type = type;
  if (data !== undefined) updateFields.data = data;
  if (sort_order !== undefined) updateFields.sort_order = sort_order;
  if (category_id !== undefined) {
    updateFields.category_id = category_id ?? null;
    // Keep the stored category_name snapshot in sync
    if (category_id) {
      const { data: cat } = await getSupabase()
        .from('custom_mission_categories')
        .select('name, emoji')
        .eq('id', category_id)
        .single();
      updateFields.category_name = cat ? `${cat.emoji} ${cat.name}` : 'My Missions';
    } else {
      updateFields.category_name = 'My Missions';
    }
  }
  if (activeFromParsed) updateFields.active_from = activeFromParsed.value;
  if (activeUntilParsed) updateFields.active_until = activeUntilParsed.value;

  const { data: mission, error } = await getSupabase()
    .from('custom_missions')
    .update(updateFields)
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
