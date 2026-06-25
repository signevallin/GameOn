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

// GET — list all categories for this admin, ordered by sort_order
export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('custom_mission_categories')
    .select('id, name, emoji, color, sort_order')
    .eq('user_id', admin.userId)
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data ?? [] });
}

// POST — create a new category { name, emoji, color? }
export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  let body: { name?: unknown; emoji?: unknown; color?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { name, emoji, color } = body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Compute next sort_order
  const { data: maxRow } = await supabase
    .from('custom_mission_categories')
    .select('sort_order')
    .eq('user_id', admin.userId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('custom_mission_categories')
    .insert({
      user_id: admin.userId,
      name: name.trim(),
      emoji: (typeof emoji === 'string' && emoji.trim()) ? emoji.trim() : '📋',
      color: (typeof color === 'string' && color.trim()) ? color.trim() : null,
      sort_order: nextOrder,
    })
    .select('id, name, emoji, color, sort_order')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}

// PUT — update category { id, name?, emoji?, color? }
export async function PUT(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  let body: { id?: unknown; name?: unknown; emoji?: unknown; color?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { id, name, emoji, color } = body;
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Verify ownership
  const { data: existing } = await supabase
    .from('custom_mission_categories')
    .select('id')
    .eq('id', id)
    .eq('user_id', admin.userId)
    .single();
  if (!existing) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (typeof name === 'string' && name.trim()) updates.name = name.trim();
  if (typeof emoji === 'string' && emoji.trim()) updates.emoji = emoji.trim();
  if (color !== undefined) updates.color = (typeof color === 'string' && color.trim()) ? color.trim() : null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('custom_mission_categories')
    .update(updates)
    .eq('id', id)
    .eq('user_id', admin.userId)
    .select('id, name, emoji, color, sort_order')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}

// DELETE — delete category by ?id= (missions get category_id = NULL via ON DELETE SET NULL)
export async function DELETE(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = getSupabase();

  // Verify the category exists and belongs to this admin
  const { data: existing } = await supabase
    .from('custom_mission_categories')
    .select('id')
    .eq('id', id)
    .eq('user_id', admin.userId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const { error } = await supabase
    .from('custom_mission_categories')
    .delete()
    .eq('id', id)
    .eq('user_id', admin.userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
