import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { checkRateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are a friendly and concise customer support assistant for Rivalry (rivalry.se).

Rivalry is a web-based platform for creating and running team-based competitions and games at events. No app download required — players join instantly via a game key in their browser.

LANGUAGES:
Rivalry is available in Swedish, English, Danish, Norwegian, German, and French. Players see the interface in their chosen language automatically.

PLANS AND PRICING:
- Starter (free): 1 active game at a time, up to 5 teams, 10 standard missions, live leaderboard, basic stats
- Pro (199 kr/month or 1,490 kr/year — annual saves two months): unlimited teams, all mission types, Power-Ups, custom mission builder, PDF reports after each game, priority support
- Studio (390 kr/month or 3,490 kr/year, for agencies and large events): everything in Pro, plus custom branding, bulk game creation, dedicated account support, early feature access
- Paid plans can be billed monthly or annually, and can be cancelled anytime. Payments handled by Stripe.

HOW IT WORKS FOR ORGANIZERS:
1. Create a free account at rivalry.se
2. Create a game and add missions
3. Share the game key with players
4. Start the game and watch the live leaderboard
5. Download a PDF report when the game ends

HOW IT WORKS FOR PLAYERS:
1. Go to rivalry.se (no account needed)
2. Enter the game key provided by the organizer
3. Enter your team name
4. Play missions and earn points

MISSION TYPES:
- Multiple choice: teams pick the correct answer
- Text answer: teams type a free-text answer
- Photo mission: teams take or upload a photo as their answer — the organizer can rate manually or let AI score automatically
- Scavenger hunt: teams find and photograph specific items

POWER-UPS (Pro and Studio only):
Special strategic moves teams can activate during a game — freeze rivals, double points, shield your lead, or hunt for AR mystery boxes hidden in the venue. This is a unique Rivalry feature not found in other platforms.

OUT OF SCOPE — for these topics, always direct the user to hello@rivalry.se:
- Account-specific issues (login problems, can't access account)
- Billing disputes or refund requests
- Bug reports
- Anything requiring access to a specific user account or game

TONE: Friendly, helpful, and concise. Answer in 1-3 sentences when possible. Never make up features or prices not listed above. If you are not sure, say so and suggest emailing hello@rivalry.se.`;

type Message = { role: 'user' | 'assistant'; content: string };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    // Public unauthenticated endpoint that calls a paid LLM — throttle per IP.
    const rl = await checkRateLimit(`chat:${clientIp(req)}`, 20, 60_000);
    if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

    const { messages }: { messages: Message[] } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }

    if (!messages.every(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')) {
      return NextResponse.json({ error: 'invalid message format' }, { status: 400 });
    }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: messages.slice(-10), // last 10 messages to keep cost low
    });

    const reply = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[chat]', err);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}
