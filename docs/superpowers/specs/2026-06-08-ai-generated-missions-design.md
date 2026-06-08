# AI-Generated Missions Design

## Goal

Let admins generate complete, ready-to-play custom missions using AI. Admin describes what they want in plain text — a topic, a theme, a free description, or topic + type — and AI produces a mission pre-filled in the existing mission form for review and optional editing before saving.

## Architecture

### New API route: `app/api/admin/ai-generate-mission/route.ts`
- `POST` — requires admin auth token
- Body: `{ prompt: string, type?: string, language: string }`
  - `prompt`: free text from admin (topic, description, or both)
  - `type`: optional — one of `trivia_quiz | truefalse | closest_wins | pa_sparet | timeline | photo`. If omitted, AI chooses the best fit.
  - `language`: the game's language code (`en`, `sv`, `no`, `da`, `de`, `fr`) — controls the language of generated content
- Calls Claude API (Anthropic SDK) with a system prompt containing exact JSON schemas for all six mission types
- If AI returns invalid JSON: server-side retry once, then return 500
- Returns: `{ type, name, icon, desc, difficulty, maxPts, data }` — identical shape to what `buildMissionData` produces, ready to pass into `openEditForm()`
- **Pro-only**: returns `{ error: 'pro_required' }` with status 403 if plan is `free`

### System prompt design
The system prompt tells Claude:
- All six mission types with their exact data schemas (same as `validateMissionData`/`buildMissionData`)
- Default content counts: 3–5 questions for trivia_quiz, 3–5 statements for truefalse, 1–3 questions for closest_wins, 3–5 clues for pa_sparet, 4–6 events for timeline, one clear instruction for photo
- To infer difficulty from the prompt (default: medium)
- To pick a fitting emoji icon and short mission name
- To write all content in the specified language
- To return only valid JSON matching the specified schema — no prose, no markdown

### AdminScreen.tsx changes
New state:
- `aiPanelOpen: boolean` — controls visibility of the generator panel in My Missions view
- `aiPrompt: string` — the text input value
- `aiType: string` — selected type or `''` (let AI choose)
- `aiGenerating: boolean` — loading state

New function: `generateWithAI()`
1. Calls `POST /api/admin/ai-generate-mission` with `{ prompt: aiPrompt, type: aiType || undefined, language }`
2. On 403 `pro_required`: shows upgrade nudge
3. On success: calls `openEditForm()` with the returned data pre-filled, closes AI panel
4. On error: shows inline error message, panel stays open for retry

**My Missions view**: "✨ Generate with AI" button alongside the existing "+ Add Mission" button. Clicking it opens the generator panel inline (not a modal) above the mission list.

**Game creation view**: A small "✨ Generate missions with AI →" text link near the mission selection area. Clicking it navigates to `view = 'missions'` and sets `aiPanelOpen = true`.

---

## UI — Generator Panel

```
┌─────────────────────────────────────────────────────┐
│  ✨ Generate with AI                          [×]   │
│                                                      │
│  Describe your mission                               │
│  ┌────────────────────────────────────────────────┐ │
│  │ e.g. "5 trivia questions about football",      │ │
│  │ "Apple product timeline", or "our company      │ │
│  │ GKN Aerospace — let AI choose type"            │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
│  Type (optional)          [Let AI choose       ▼]   │
│                                                      │
│  [✨ Generate]   ← spinner while loading            │
│  error message if failed                             │
└─────────────────────────────────────────────────────┘
```

- Text area: multiline, ~3 rows
- Type dropdown options: Let AI choose / Trivia Quiz / True or False / Closest Wins / På Spåret / Timeline / Photo
- Generate button: disabled while `aiGenerating`
- On success: panel closes, mission form opens pre-filled
- On error: error text under button, panel stays open

---

## Pro Gate

- Free plan admins see the "✨ Generate with AI" button but clicking it shows an inline message: *"AI mission generation requires Pro. Upgrade to unlock."* with an upgrade CTA — same pattern as other Pro-gated features in AdminScreen.
- No separate modal needed — inline nudge in the panel is sufficient.

---

## Data Flow

```
Admin types prompt + optional type
  → clicks Generate
  → POST /api/admin/ai-generate-mission
      → validateAdminToken
      → check plan (403 if free)
      → build system prompt with schemas + language
      → call Claude API
      → parse JSON response (retry once on invalid JSON)
      → return { type, name, icon, desc, difficulty, maxPts, data }
  → AdminScreen receives response
  → openEditForm() called with pre-filled data
  → Admin reviews / edits in existing form
  → Saves as normal custom mission
```

---

## Error States

| Scenario | Behaviour |
|----------|-----------|
| Free plan | 403 → inline upgrade nudge in panel |
| Empty prompt | Client-side validation — disable Generate button |
| AI timeout / network error | Error message under button, retry allowed |
| AI returns invalid JSON (after retry) | "Generation failed — try rephrasing your prompt" |
| Prompt too vague | AI generates something reasonable; admin edits |

---

## Out of Scope

- Streaming / token-by-token generation
- Generating multiple missions at once
- AI suggesting missions automatically without admin input
- Editing the AI prompt interactively (chat-style)
