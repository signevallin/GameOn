import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { getSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

function getClient() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  return new Anthropic({ apiKey: key });
}

const MISSION_SCHEMAS = `Schemas (use EXACTLY these field names):

trivia_quiz — multiple choice questions:
{"type":"trivia_quiz","name":"...","icon":"...","desc":"...","difficulty":"easy|medium|hard","maxPts":500,"triviaRounds":[{"question":"What is the capital of France?","options":["London","Berlin","Paris","Rome"],"answer":"Paris"}]}
Generate 3-5 questions. options is always exactly 4 full-text strings (never A/B/C/D letters). answer MUST be copied verbatim from one of the options — exact same string, character for character.

truefalse — true or false statements:
{"type":"truefalse","name":"...","icon":"...","desc":"...","difficulty":"easy|medium|hard","maxPts":400,"statements":[{"text":"...","answer":true}]}
Generate 3-5 statements. answer is a boolean.

closest_wins — guess a number, closest wins:
{"type":"closest_wins","name":"...","icon":"...","desc":"...","difficulty":"easy|medium|hard","maxPts":400,"closestQuestions":[{"q":"...","answer":"42","unit":"years","hint":"..."}]}
Generate 1-3 questions. answer is a string representation of a number. unit is the unit of measurement (e.g. "km", "years", "kg"). hint is an optional helpful hint.

pa_sparet — progressive clues leading to a hidden answer:
{"type":"pa_sparet","name":"...","icon":"...","desc":"...","difficulty":"easy|medium|hard","maxPts":500,"clues":["vague clue","more specific","most specific"],"paAnswer":"..."}
Generate 3-5 clues, each progressively more revealing. paAnswer is the final answer.

timeline — sort events in chronological order:
{"type":"timeline","name":"...","icon":"...","desc":"...","difficulty":"easy|medium|hard","maxPts":500,"timelineItems":[{"label":"...","year":"1984"}]}
Generate 4-6 events. year is a 4-digit string. Items will be scrambled for players to sort.

photo — teams photograph something:
{"type":"photo","name":"...","icon":"...","desc":"...","difficulty":"easy|medium|hard","maxPts":600,"photoPrompt":"..."}
photoPrompt is one clear instruction for what to photograph.

Field rules:
- name: max 40 chars, engaging title
- icon: single emoji relevant to the topic
- desc: one sentence describing what players do (not the answer)
- difficulty: easy = common knowledge, medium = requires thought, hard = specialists only
- maxPts: 300-400 for easy, 400-600 for medium/hard
- Write ALL content in the language specified in the user message`;

const SINGLE_SYSTEM_PROMPT = `You generate custom missions for a team game app called GameOn.
Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

Choose the most interesting type for the topic unless the user specifies one.

${MISSION_SCHEMAS}
- Return ONLY the JSON object`;

const BULK_SYSTEM_PROMPT = `You generate custom missions for a team game app called GameOn.
Return ONLY a valid JSON object with a "missions" key containing an array — no markdown, no explanation, no code fences.

Choose the most interesting and VARIED types across missions unless the user specifies one type.

${MISSION_SCHEMAS}
- Return ONLY: {"missions": [mission1, mission2, ...]}
- Each mission must be on a DIFFERENT aspect or angle of the topic
- Vary the mission types as much as possible (don't use the same type for all missions)`;

async function callClaude(userMessage: string, systemPrompt: string, maxTokens: number): Promise<string> {
  const message = await getClient().messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userMessage }],
    system: systemPrompt,
  });
  const block = message.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type');
  return block.text;
}

function parseJSON(text: string): Record<string, unknown> | null {
  // Strip markdown code fences if Claude added them despite instructions
  const stripped = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    // Try extracting first {...} block
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  // Check pro plan
  const subscription = await getSubscription(admin.userId);
  if (!subscription || subscription.plan === 'free') {
    return NextResponse.json({ error: 'pro_required' }, { status: 403 });
  }

  let body: { prompt?: unknown; type?: unknown; language?: unknown; excludedNames?: unknown; count?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { prompt, type, language, excludedNames, count } = body;

  let safeExcluded: string[] = [];
  if (excludedNames !== undefined && excludedNames !== null) {
    if (!Array.isArray(excludedNames)) {
      return NextResponse.json({ error: 'invalid_excluded_names' }, { status: 400 });
    }
    safeExcluded = excludedNames
      .filter((n): n is string => typeof n === 'string')
      .map(n => n.trim())
      .filter(n => n.length > 0 && n.length <= 100)
      .slice(0, 50);
  }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return NextResponse.json({ error: 'prompt_required' }, { status: 400 });
  }

  if (!language || typeof language !== 'string') {
    return NextResponse.json({ error: 'language_required' }, { status: 400 });
  }

  const VALID_TYPES = ['trivia_quiz', 'truefalse', 'closest_wins', 'pa_sparet', 'timeline', 'photo'];
  if (type !== undefined && type !== null && typeof type === 'string' && !VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }

  const safeCount = typeof count === 'number' && Number.isInteger(count) && count >= 2 && count <= 5
    ? count
    : 1;

  const typeInstruction = (typeof type === 'string' && type) ? `Mission type: ${type}` : 'Choose the best mission type for this content.';
  const exclusionLine = safeExcluded.length > 0
    ? `\n\nDo NOT create missions about any of these topics (already used): ${safeExcluded.join(', ')}`
    : '';

  if (safeCount === 1) {
    // Single mission — existing behaviour
    const userMessage = `${typeInstruction}
Language: ${language}
Topic/description: ${prompt}${exclusionLine}`;

    let raw: string;
    try {
      raw = await callClaude(userMessage, SINGLE_SYSTEM_PROMPT, 2048);
    } catch (err) {
      console.error('Claude API error:', err);
      return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
    }
    let parsed = parseJSON(raw);

    if (!parsed) {
      try {
        raw = await callClaude(userMessage + '\n\nIMPORTANT: Return ONLY the JSON object. No other text.', SINGLE_SYSTEM_PROMPT, 2048);
      } catch (err) {
        console.error('Claude API retry error:', err);
        return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
      }
      parsed = parseJSON(raw);
    }

    if (!parsed) {
      return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
    }

    return NextResponse.json(parsed);
  }

  // Bulk mode — ask Claude to return { missions: [...] }
  const userMessage = `Generate exactly ${safeCount} distinct missions.
${typeInstruction}
Language: ${language}
Topic/description: ${prompt}${exclusionLine}`;

  let raw: string;
  try {
    raw = await callClaude(userMessage, BULK_SYSTEM_PROMPT, 2048 * safeCount);
  } catch (err) {
    console.error('Claude API error (bulk):', err);
    return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
  }
  let parsed = parseJSON(raw);

  if (!parsed || !Array.isArray(parsed.missions)) {
    try {
      raw = await callClaude(
        userMessage + '\n\nIMPORTANT: Return ONLY {"missions": [...]}. No other text.',
        BULK_SYSTEM_PROMPT,
        2048 * safeCount,
      );
    } catch (err) {
      console.error('Claude API retry error (bulk):', err);
      return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
    }
    parsed = parseJSON(raw);
  }

  if (!parsed || !Array.isArray(parsed.missions) || parsed.missions.length === 0) {
    return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
  }

  return NextResponse.json({ missions: parsed.missions });
}
