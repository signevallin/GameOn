import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { getSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is not set');
}
const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You generate custom missions for a team game app called GameOn.
Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

Choose the most interesting type for the topic unless the user specifies one.

Schemas (use EXACTLY these field names):

trivia_quiz — multiple choice questions:
{"type":"trivia_quiz","name":"...","icon":"...","desc":"...","difficulty":"easy|medium|hard","maxPts":500,"triviaRounds":[{"question":"...","options":["A","B","C","D"],"answer":"A"}]}
Generate 3-5 questions. options is always exactly 4 strings. answer must match one of the options exactly (the full option text).

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
- Write ALL content in the language specified in the user message
- Return ONLY the JSON object`;

async function callClaude(userMessage: string): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 2048,
    messages: [{ role: 'user', content: userMessage }],
    system: SYSTEM_PROMPT,
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
    return null;
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

  let body: { prompt?: unknown; type?: unknown; language?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const { prompt, type, language } = body;

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

  const typeInstruction = (typeof type === 'string' && type) ? `Mission type: ${type}` : 'Choose the best mission type for this content.';
  const userMessage = `${typeInstruction}
Language: ${language}
Topic/description: ${prompt}`;

  // First attempt
  let raw: string;
  try {
    raw = await callClaude(userMessage);
  } catch (err) {
    console.error('Claude API error:', err);
    return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
  }
  let parsed = parseJSON(raw);

  // Retry once if invalid JSON
  if (!parsed) {
    try {
      raw = await callClaude(userMessage + '\n\nIMPORTANT: Return ONLY the JSON object. No other text.');
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
