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

const SYSTEM_PROMPT = `You are a game mission generator for GameOn, a team trivia and activity game platform.

Generate a single complete mission as JSON. The user will tell you the topic, theme, or description.

The mission types and their exact schemas are:

**trivia_quiz** — multiple-choice trivia:
{
  "type": "trivia_quiz",
  "name": "string (short, max 40 chars)",
  "icon": "single emoji",
  "desc": "string (1-2 sentences describing the mission)",
  "difficulty": "easy" | "medium" | "hard",
  "maxPts": 500,
  "data": {
    "questions": [
      {
        "q": "question text",
        "options": ["A", "B", "C", "D"],
        "answer": 0  // index of correct option (0-3)
      }
    ]
  }
}
Generate 3-5 questions.

**truefalse** — true/false statements:
{
  "type": "truefalse",
  "name": "string",
  "icon": "single emoji",
  "desc": "string",
  "difficulty": "easy" | "medium" | "hard",
  "maxPts": 300,
  "data": {
    "statements": [
      {
        "text": "statement text",
        "answer": true | false
      }
    ]
  }
}
Generate 3-5 statements.

**closest_wins** — numeric estimation:
{
  "type": "closest_wins",
  "name": "string",
  "icon": "single emoji",
  "desc": "string",
  "difficulty": "easy" | "medium" | "hard",
  "maxPts": 400,
  "data": {
    "questions": [
      {
        "q": "question text",
        "answer": 42  // the correct numeric answer
      }
    ]
  }
}
Generate 1-3 questions.

**pa_sparet** — progressive clue guessing (Swedish TV show concept):
{
  "type": "pa_sparet",
  "name": "string",
  "icon": "single emoji",
  "desc": "string",
  "difficulty": "easy" | "medium" | "hard",
  "maxPts": 600,
  "data": {
    "answer": "the thing being guessed",
    "clues": ["most obscure clue", "less obscure", "medium clue", "easier clue", "easiest clue"]
  }
}
Generate exactly 5 clues ordered from hardest to easiest. Teams guess after each clue — more points for guessing earlier.

**timeline** — order events chronologically:
{
  "type": "timeline",
  "name": "string",
  "icon": "single emoji",
  "desc": "string",
  "difficulty": "easy" | "medium" | "hard",
  "maxPts": 400,
  "data": {
    "events": [
      {
        "label": "event name",
        "year": 1969
      }
    ]
  }
}
Generate 4-6 events. They will be shuffled for the player; you provide them in any order.

**photo** — take a photo matching the description:
{
  "type": "photo",
  "name": "string",
  "icon": "single emoji",
  "desc": "string (this IS the photo instruction — make it clear and fun)",
  "difficulty": "easy" | "medium" | "hard",
  "maxPts": 300,
  "data": {
    "instruction": "Detailed instruction for what photo to take"
  }
}

Rules:
- Infer difficulty from the prompt (default: medium)
- Pick a fitting emoji for icon
- Write a short, catchy mission name (max 40 chars)
- Write all content (name, desc, questions, etc.) in the language specified by the user
- If the user specifies a type, use that type. If not, pick the best type for the content.
- Return ONLY valid JSON. No markdown, no code fences, no explanation — just the raw JSON object.`;

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
