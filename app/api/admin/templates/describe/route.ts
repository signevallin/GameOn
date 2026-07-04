// app/api/admin/templates/describe/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { getEffectivePlan } from '@/lib/subscription';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  return new Anthropic({ apiKey: key });
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  if (await getEffectivePlan(admin.userId) === 'free') {
    return NextResponse.json({ error: 'pro_required' }, { status: 403 });
  }

  const body = await req.json();
  const { name, missionIds } = body as { name?: string; missionIds?: string[] };

  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!Array.isArray(missionIds) || missionIds.length === 0) {
    return NextResponse.json({ error: 'missionIds is required' }, { status: 400 });
  }

  // Fetch mission titles from custom_missions (builtin missions don't have a DB row)
  const db = adminClient();
  const { data: customMissions, error: dbError } = await db
    .from('custom_missions')
    .select('id, name')
    .in('id', missionIds);
  if (dbError) console.error('[templates/describe] DB error', dbError);

  const missionNames = (customMissions ?? []).map(m => m.name);

  const prompt = `You write short descriptions for game templates in an event management app.

Template name: "${name}"
Missions included: ${missionNames.length > 0 ? missionNames.join(', ') : 'various missions'}

Write a 1-2 sentence description for event organizers explaining what this template is good for and what makes it fun. Be concise and energetic. Return ONLY the description text, no quotes.`;

  try {
    const response = await getClient().messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    return NextResponse.json({ description: text });
  } catch (err) {
    console.error('[templates/describe]', err);
    return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
  }
}
