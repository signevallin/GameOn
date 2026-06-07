// app/api/admin/templates/route.ts
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

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const db = adminClient();
  const [builtinsResult, ownResult] = await Promise.all([
    db.from('game_templates').select('*').eq('is_builtin', true).order('created_at'),
    db.from('game_templates').select('*').eq('is_builtin', false).eq('user_id', admin.userId).order('created_at', { ascending: false }),
  ]);

  if (builtinsResult.error) return NextResponse.json({ error: builtinsResult.error.message }, { status: 500 });
  if (ownResult.error) return NextResponse.json({ error: ownResult.error.message }, { status: 500 });

  const templates = [
    ...(builtinsResult.data || []).map(toGameTemplate),
    ...(ownResult.data || []).map(toGameTemplate),
  ];

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { name, icon, description, missionIds, isBuiltin } = await req.json();
  if (!name || !Array.isArray(missionIds) || missionIds.length === 0) {
    return NextResponse.json({ error: 'name and missionIds are required' }, { status: 400 });
  }
  if (isBuiltin && !admin.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = adminClient();
  const { data, error } = await db
    .from('game_templates')
    .insert({
      name,
      icon: icon || '🎮',
      description: description || null,
      mission_ids: missionIds,
      is_builtin: isBuiltin ?? false,
      user_id: isBuiltin ? null : admin.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: toGameTemplate(data) });
}
