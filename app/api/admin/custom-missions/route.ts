// app/api/admin/custom-missions/route.ts
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

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { data, error } = await getSupabase()
    .from('custom_missions')
    .select('*')
    .eq('user_id', admin.userId)
    .order('sort_order')
    .order('created_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ missions: data ?? [] });
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const body = await req.json();
  const { category_name, category_id, name, icon, desc, difficulty, max_pts, type, data, sort_order, active_from, active_until } = body;

  const activeFrom = parseActiveWindow(active_from);
  if (!activeFrom.ok) return NextResponse.json({ error: 'Invalid active_from.' }, { status: 400 });
  const activeUntil = parseActiveWindow(active_until);
  if (!activeUntil.ok) return NextResponse.json({ error: 'Invalid active_until.' }, { status: 400 });

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
  if (!type) return NextResponse.json({ error: 'Type is required.' }, { status: 400 });

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (category_id && (typeof category_id !== 'string' || !UUID_RE.test(category_id))) {
    return NextResponse.json({ error: 'Invalid category_id.' }, { status: 400 });
  }

  // Resolve actual category name from the DB so it's always in sync
  let resolvedCategoryName = category_name ?? 'My Missions';
  if (category_id) {
    const { data: cat } = await getSupabase()
      .from('custom_mission_categories')
      .select('name, emoji')
      .eq('id', category_id)
      .single();
    if (cat) resolvedCategoryName = `${cat.emoji} ${cat.name}`;
  }

  const { data: mission, error } = await getSupabase()
    .from('custom_missions')
    .insert({
      user_id: admin.userId,
      category_name: resolvedCategoryName,
      category_id: category_id ?? null,
      name: name.trim(),
      icon: icon ?? '⭐',
      desc: desc ?? '',
      difficulty: difficulty ?? 'medium',
      max_pts: max_pts ?? 500,
      type,
      data: data ?? {},
      sort_order: sort_order ?? 0,
      active_from: activeFrom.value,
      active_until: activeUntil.value,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ mission });
}

