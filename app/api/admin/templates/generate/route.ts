// app/api/admin/templates/generate/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { getEffectivePlan } from '@/lib/subscription';
import { checkRateLimit, tooManyRequests } from '@/lib/rate-limit';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';

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

function parseJSON(text: string): Record<string, unknown> | null {
  // Try direct parse first
  try { return JSON.parse(text.trim()); } catch { /* fall through */ }
  // Extract first {...} block (handles preamble text and markdown fences)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

export interface GeneratedMission {
  title: string;
  icon: string;
  type: string;
  points: number;
  description: string;
}

export interface GeneratedTemplate {
  name: string;
  icon: string;
  description: string;
  activeFrom: string | null;
  activeTo: string | null;
  selectedMissionIds: string[];
  newMissions: GeneratedMission[];
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  if (await getEffectivePlan(admin.userId) === 'free') {
    return NextResponse.json({ error: 'pro_required' }, { status: 403 });
  }

  const rl = await checkRateLimit(`templates-generate:${admin.userId}`, 20, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const body = await req.json();
  const { prompt } = body as { prompt?: string };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  // Build mission pool: static built-ins + admin's custom missions
  const db = adminClient();
  const { data: customMissions, error: dbError } = await db
    .from('custom_missions')
    .select('id, name, type, max_pts')
    .eq('user_id', admin.userId);

  if (dbError) console.error('[templates/generate] DB error', dbError);

  const builtinPool = MISSIONS.slice(0, 80).map(m => ({
    id: m.id,
    title: m.name,
    type: m.type,
  }));

  const customPool = (customMissions ?? []).map(m => ({
    id: m.id,
    title: m.name,
    type: m.type,
  }));

  const missionPoolText = [...builtinPool, ...customPool]
    .map(m => `- id:${m.id} | "${m.title}" | type:${m.type}`)
    .join('\n');

  const systemPrompt = `You generate game templates for Rivalry, a team event platform.

Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

Schema:
{
  "name": "Short catchy template name (max 40 chars)",
  "icon": "Single relevant emoji",
  "description": "1-2 sentences describing what makes this event fun (for organizers)",
  "activeFrom": "MM-DD or null (set if the event is seasonal, e.g. Halloween = '10-01')",
  "activeTo": "MM-DD or null (end of season, e.g. '10-31')",
  "selectedMissionIds": ["id from the pool that fits this event theme"],
  "newMissions": [
    {
      "title": "Mission title (max 40 chars)",
      "icon": "Single relevant emoji for this specific mission",
      "type": "photo",
      "points": 300,
      "description": "One sentence: what teams must do"
    }
  ]
}

Rules:
- Select 6-12 missions from the pool that best fit the event. Prefer existing missions when they fit.
- Only add newMissions when the pool lacks enough suitable missions for the theme (target: at least 3 new if theme is very specific).
- newMissions MUST always use type "photo" — no other types are supported for new missions.
- newMissions.points: 200-600 depending on difficulty.
- Set activeFrom/activeTo only for clearly seasonal events (Halloween, Christmas, summer, etc.).
- Return ONLY the JSON object.`;

  const userMessage = `Event description: ${prompt.trim()}\n\nMission pool:\n${missionPoolText}`;

  let raw: string;
  try {
    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type');
    raw = block.text;
  } catch (err) {
    console.error('[templates/generate] Claude error:', err);
    return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
  }

  const parsed = parseJSON(raw);
  if (!parsed) {
    console.error('[templates/generate] Failed to parse JSON:', raw.slice(0, 200));
    return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
  }

  // Build set of all known IDs so we can filter hallucinated ones
  const knownIds = new Set([...builtinPool, ...customPool].map(m => m.id));
  if (Array.isArray(parsed.selectedMissionIds)) {
    const before = (parsed.selectedMissionIds as string[]).length;
    parsed.selectedMissionIds = (parsed.selectedMissionIds as string[]).filter(
      (id): id is string => typeof id === 'string' && knownIds.has(id)
    );
    const filtered = before - (parsed.selectedMissionIds as string[]).length;
    if (filtered > 0) {
      console.warn(`[templates/generate] Filtered ${filtered} hallucinated mission IDs`);
    }
  }

  // Force all new missions to type "photo" — other types require structured data we can't generate
  if (Array.isArray(parsed.newMissions)) {
    parsed.newMissions = (parsed.newMissions as GeneratedMission[]).map(m => ({ ...m, type: 'photo' }));
  }

  return NextResponse.json(parsed as unknown as GeneratedTemplate);
}
