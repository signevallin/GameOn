// app/api/admin/templates/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { toGameTemplate } from '@/lib/templates';
import { isTemplateActive } from '@/lib/template-utils';

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

  const all = [
    ...(builtinsResult.data || []).map(toGameTemplate),
    ...(ownResult.data || []).map(toGameTemplate),
  ];

  // Non-superadmins only see templates that are currently active
  const templates = admin.isSuperAdmin
    ? all
    : all.filter(t => isTemplateActive(t.activeFrom, t.activeTo));

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { name, icon, description, missionIds, isBuiltin, activeFrom, activeTo } = await req.json();
  if (!name || !Array.isArray(missionIds) || missionIds.length === 0) {
    return NextResponse.json({ error: 'name and missionIds are required' }, { status: 400 });
  }
  if (isBuiltin && !admin.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validate MM-DD format if provided
  const mmddRe = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (activeFrom && !mmddRe.test(activeFrom)) {
    return NextResponse.json({ error: 'activeFrom must be MM-DD' }, { status: 400 });
  }
  if (activeTo && !mmddRe.test(activeTo)) {
    return NextResponse.json({ error: 'activeTo must be MM-DD' }, { status: 400 });
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
      active_from: activeFrom || null,
      active_to: activeTo || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: toGameTemplate(data) });
}
