import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const db = adminClient();

  const { data: game } = await db
    .from('games')
    .select('user_id')
    .eq('id', params.id)
    .single();

  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!admin.isSuperAdmin && game.user_id !== admin.userId)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const updates: Record<string, unknown> = {};
  if (typeof body.ai_photo_rating === 'boolean') updates.ai_photo_rating = body.ai_photo_rating;
  if (body.ai_photo_instructions === null || (typeof body.ai_photo_instructions === 'string' && body.ai_photo_instructions.length <= 2000)) {
    updates.ai_photo_instructions = body.ai_photo_instructions;
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });

  const { error } = await db.from('games').update(updates).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
