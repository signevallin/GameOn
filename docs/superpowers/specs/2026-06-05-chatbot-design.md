# Customer Service Chatbot Design

**Date:** 2026-06-05
**Status:** Approved

---

## Goal

Add an AI-powered customer service chat widget to the GameOn landing page that answers visitor questions about features, pricing, and how to get started — without requiring human involvement.

## Architecture

### New files

**`components/ChatWidget.tsx`**
Client component. Renders a floating circular button (bottom-right, 52×52px, GameOn gradient). On click, opens a chat panel anchored to the bottom-right corner. Manages conversation history in React state (array of `{ role: 'user' | 'assistant', content: string }`). On each user message, POSTs the last 10 messages to `/api/chat` and appends the assistant response. Shows a typing indicator while waiting.

**`app/api/chat/route.ts`**
Public POST route (no auth). Accepts `{ messages: { role, content }[] }`. Calls Anthropic API (`claude-3-5-haiku-20241022`) with the GameOn system prompt prepended. Returns `{ reply: string }` as JSON. No streaming — simple request/response is sufficient for a FAQ bot.

### Modified files

**`app/page.tsx`**
Import and render `<ChatWidget />` at the bottom of the JSX, just before the closing `</div>`. The widget is self-contained and does not affect existing layout.

### Environment variables

`ANTHROPIC_API_KEY` — must be added to Vercel project settings.

---

## UI Design

- **Closed state:** 52×52px circle, `linear-gradient(135deg, #7CBDD4, #4890aa)`, chat icon (white stroke), fixed bottom-right `24px` from edges. Box shadow: `0 4px 20px rgba(124,189,212,0.4)`.
- **Open state:** 340×480px panel, `background: #131F2E`, `border: 1px solid rgba(124,189,212,0.15)`, `border-radius: 16px`, box shadow. Fixed bottom-right, positioned above the bubble button.
- **Panel header:** GameOn gradient, "GameOn Support" title, "Powered by AI" subtitle, close (×) button.
- **Messages:** Bot messages left-aligned with small avatar circle. User messages right-aligned with subtle teal background. Font: Sora, 13px, line-height 1.6.
- **Input area:** Text input + send button (teal gradient). Send on Enter key or button click.
- **Welcome message:** Bot sends on open: *"Hi! I can answer questions about GameOn — features, pricing, or how to get started. What would you like to know?"*
- **Typing indicator:** Three animated dots shown while awaiting API response.
- **Error state:** If API call fails, show: *"Sorry, something went wrong. Email us at hello@playgameon.app"*

---

## System Prompt

The system prompt instructs Claude to act as a GameOn support assistant with the following knowledge:

**What GameOn is:**
GameOn is a web-based platform for creating and running team-based competitions and games at events. No app download required — players join instantly via a game key in their browser.

**Plans and pricing:**
- Starter (free): 1 active game, up to 5 teams, core missions
- Pro (499 SEK/year): unlimited games, up to 20 teams, custom missions, photo missions, Power-Ups, PDF reports
- Studio (999 SEK/year): unlimited games, unlimited teams, all Pro features, priority support

**How it works for organizers:**
Create an account → create a game → share the game key with players → start the game → view live leaderboard → download PDF report after.

**How it works for players:**
Go to playgameon.app → enter game key → enter team name → play missions.

**Mission types:**
Multiple choice, text answer, photo missions (upload a photo as answer), scavenger hunt.

**Power-Ups:**
Strategic moves teams can use during a game to gain advantages (steal points, block opponents, double points, etc.). Unique to GameOn.

**Contact:**
hello@playgameon.app for billing, account issues, or anything the bot cannot answer.

**Out of scope (bot deflects to email):**
- Account-specific issues (login problems, billing disputes)
- Bug reports
- Refund requests
- Anything requiring access to the user's account

**Tone:** Friendly, concise, helpful. Never make up features or prices. If unsure, say so and direct to email.

---

## Constraints

- No server-side conversation persistence — history lives in client state only, reset on page reload.
- Last 10 messages sent per API call to keep token cost low.
- No rate limiting in v1 — acceptable for a landing page with low traffic.
- Widget only appears on `app/page.tsx` (the landing page), not on `/play`.
