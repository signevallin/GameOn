# AI-Generated Missions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins generate complete custom missions by describing what they want in plain text — AI produces a pre-filled mission form ready to review and save.

**Architecture:** A new POST API route calls Claude (Haiku) with a structured system prompt containing all six mission type schemas; the response is a flat JSON object that maps directly to `MissionFormData` in AdminScreen. AdminScreen gets a collapsible AI panel in the My Missions view plus a shortcut button in the games list header.

**Tech Stack:** Next.js App Router, Anthropic SDK (`@anthropic-ai/sdk`), TypeScript, inline styles (no Tailwind/CSS modules).

---

## File Structure

| File | Change |
|------|--------|
| `app/api/admin/ai-generate-mission/route.ts` | **Create** — POST endpoint: auth, pro-gate, Claude call, JSON parse + retry |
| `components/screens/AdminScreen.tsx` | **Modify** — AI state + `generateWithAI()` + panel UI in missions view + shortcut in games header |

---

### Task 1: API route — `app/api/admin/ai-generate-mission/route.ts`

**Files:**
- Create: `app/api/admin/ai-generate-mission/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/admin/ai-generate-mission/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { getSubscription } from '@/lib/subscription';

export const dynamic = 'force-dynamic';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You generate custom missions for a team game app called GameOn.
Return ONLY a valid JSON object — no markdown, no explanation, no code fences.

Choose the most interesting type for the topic unless the user specifies one.

Schemas (use EXACTLY these field names):

trivia_quiz — multiple choice questions:
{"type":"trivia_quiz","name":"...","icon":"...","desc":"...","difficulty":"easy|medium|hard","maxPts":500,"triviaRounds":[{"question":"...","options":["A","B","C","D"],"answer":"A"}]}
Generate 3-5 questions. options is always exactly 4 strings. answer must match one of the options exactly.

truefalse — true or false statements:
{"type":"truefalse","name":"...","icon":"...","desc":"...","difficulty":"easy|medium|hard","maxPts":400,"statements":[{"text":"...","answer":true}]}
Generate 3-5 statements. answer is a boolean.

closest_wins — guess a number, closest wins:
{"type":"closest_wins","name":"...","icon":"...","desc":"...","difficulty":"easy|medium|hard","maxPts":400,"closestQuestions":[{"q":"...","answer":"42","unit":"years","hint":"..."}]}
Generate 1-3 questions. answer is a string representation of a number. unit is the unit of measurement (e.g. "km", "years", "kg").

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
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });
  const block = response.content[0];
  return block?.type === 'text' ? block.text.trim() : '';
}

function parseJSON(text: string): Record<string, unknown> | null {
  try {
    // Strip accidental markdown fences
    const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const sub = await getSubscription(admin.userId);
  if (sub.plan === 'free') {
    return NextResponse.json({ error: 'pro_required' }, { status: 403 });
  }

  const { prompt, type, language } = await req.json() as {
    prompt: string;
    type?: string;
    language?: string;
  };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  const lang = language ?? 'en';
  const typeInstruction = type ? `Mission type: ${type}. ` : '';
  const userMessage = `${typeInstruction}Language: ${lang}. Request: ${prompt.trim()}`;

  // First attempt
  let raw = await callClaude(userMessage);
  let parsed = parseJSON(raw);

  // Retry once if parse failed
  if (!parsed) {
    raw = await callClaude(userMessage + '\n\nIMPORTANT: Return ONLY the JSON object, nothing else.');
    parsed = parseJSON(raw);
  }

  if (!parsed) {
    return NextResponse.json({ error: 'generation_failed' }, { status: 500 });
  }

  return NextResponse.json(parsed);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/ai-generate-mission/route.ts
git commit -m "feat: add AI mission generation API route"
```

---

### Task 2: AdminScreen — AI state, panel UI, and shortcut

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

The changes are in four places:
1. State declarations (near line 453 where other mission state lives)
2. `generateWithAI()` function (inside `if (view === 'missions')` block, near line 1295)
3. AI panel UI (inside `if (view === 'missions')` block, before the `!showMissionForm && <button>+ Add Mission</button>` at line 1482)
4. "✨ Generate with AI" shortcut button in the games list header (near line 1174 where the My Missions button lives)

- [ ] **Step 1: Add AI state variables**

Find the block near line 453 that reads:
```typescript
  const [showMissionForm, setShowMissionForm] = useState(false);
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [missionForm, setMissionForm] = useState<MissionFormData>(EMPTY_FORM);
  const [missionFormError, setMissionFormError] = useState('');
```

Add after `missionFormError`:
```typescript
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiType, setAiType] = useState('');
  const [aiLanguage, setAiLanguage] = useState('en');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Add `generateWithAI` function**

Inside `if (view === 'missions')` (around line 1295), after the `openEditForm` function definition, add:

```typescript
    async function generateWithAI() {
      if (!aiPrompt.trim()) return;
      setAiGenerating(true);
      setAiError('');
      try {
        const res = await fetch('/api/admin/ai-generate-mission', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            prompt: aiPrompt,
            ...(aiType ? { type: aiType } : {}),
            language: aiLanguage,
          }),
        });

        if (res.status === 403) {
          setAiError('pro_required');
          return;
        }
        if (!res.ok) {
          setAiError('Generation failed — try rephrasing your prompt.');
          return;
        }

        const mission = await res.json() as {
          type: string; name: string; icon: string; desc: string;
          difficulty: 'easy' | 'medium' | 'hard'; maxPts: number;
          triviaRounds?: { question: string; options: [string, string, string, string]; answer: string }[];
          statements?: { text: string; answer: boolean }[];
          closestQuestions?: { q: string; answer: string; unit: string; hint: string }[];
          clues?: string[];
          paAnswer?: string;
          timelineItems?: { label: string; year: string }[];
          photoPrompt?: string;
        };

        setEditingMissionId(null);
        setMissionForm({
          name: mission.name ?? '',
          icon: mission.icon ?? '⭐',
          desc: mission.desc ?? '',
          difficulty: mission.difficulty ?? 'medium',
          maxPts: mission.maxPts ?? 500,
          type: mission.type ?? '',
          triviaRounds: mission.triviaRounds ?? [],
          statements: mission.statements ?? [],
          closestQuestions: mission.closestQuestions ?? [],
          clues: mission.clues ?? [],
          paAnswer: mission.paAnswer ?? '',
          timelineItems: mission.timelineItems ?? [],
          photoPrompt: mission.photoPrompt ?? '',
        });
        setMissionFormError('');
        setShowMissionForm(true);
        setAiPanelOpen(false);
        setAiPrompt('');
        setAiType('');
      } catch {
        setAiError('Generation failed — try rephrasing your prompt.');
      } finally {
        setAiGenerating(false);
      }
    }
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Add AI panel UI in missions view**

Find the section around line 1482:
```typescript
          {/* Add / Edit form */}
          {!showMissionForm && (
            <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={openNewForm}>+ Add Mission</button>
          )}
```

Replace with:
```typescript
          {/* Add / Edit form */}
          {!showMissionForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* AI generate button */}
              <button
                className="btn btn-ghost"
                style={{ width: '100%', padding: '12px', border: '1px solid rgba(124,189,212,0.3)', color: '#7CBDD4' }}
                onClick={() => { setAiPanelOpen(v => !v); setAiError(''); }}
              >
                ✨ {aiPanelOpen ? 'Close AI Generator' : 'Generate with AI'}
              </button>

              {/* AI panel */}
              {aiPanelOpen && (
                <div className="card" style={{ marginBottom: '4px' }}>
                  <h3 style={{ marginBottom: '16px', fontSize: '15px', color: '#7CBDD4' }}>✨ Generate with AI</h3>

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', letterSpacing: '.1em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>DESCRIBE YOUR MISSION</label>
                    <textarea
                      rows={3}
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      placeholder={'e.g. "5 trivia questions about football", "Apple product timeline", "let AI choose a type about our company GKN Aerospace"'}
                      style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', color: 'var(--text)', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ fontSize: '11px', letterSpacing: '.1em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>TYPE (OPTIONAL)</label>
                      <select
                        value={aiType}
                        onChange={e => setAiType(e.target.value)}
                        style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' }}
                      >
                        <option value="">Let AI choose</option>
                        <option value="trivia_quiz">Trivia Quiz</option>
                        <option value="truefalse">True or False</option>
                        <option value="closest_wins">Closest Wins</option>
                        <option value="pa_sparet">På Spåret</option>
                        <option value="timeline">Timeline</option>
                        <option value="photo">Photo</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', letterSpacing: '.1em', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>LANGUAGE</label>
                      <select
                        value={aiLanguage}
                        onChange={e => setAiLanguage(e.target.value)}
                        style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text)', fontSize: '13px' }}
                      >
                        <option value="en">English</option>
                        <option value="sv">Svenska</option>
                        <option value="no">Norsk</option>
                        <option value="da">Dansk</option>
                        <option value="de">Deutsch</option>
                        <option value="fr">Français</option>
                      </select>
                    </div>
                  </div>

                  {aiError === 'pro_required' ? (
                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
                      AI mission generation requires Pro.{' '}
                      <span style={{ color: '#7CBDD4', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleUpgrade('pro')}>Upgrade →</span>
                    </div>
                  ) : aiError ? (
                    <div style={{ fontSize: '13px', color: 'var(--danger, #e74c3c)', marginBottom: '12px' }}>{aiError}</div>
                  ) : null}

                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', opacity: (!aiPrompt.trim() || aiGenerating) ? 0.5 : 1 }}
                    disabled={!aiPrompt.trim() || aiGenerating}
                    onClick={generateWithAI}
                  >
                    {aiGenerating ? '✨ Generating…' : '✨ Generate'}
                  </button>
                </div>
              )}

              <button className="btn btn-ghost" style={{ width: '100%', padding: '12px' }} onClick={openNewForm}>+ Add Mission Manually</button>
            </div>
          )}
```

- [ ] **Step 6: Add shortcut button in games list header**

Find around line 1174:
```typescript
            {plan === 'free' ? (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px', color: '#7CBDD4', border: '1px solid rgba(124,189,212,0.3)' }} onClick={() => handleUpgrade('pro')} disabled={upgradeLoading}>🔒 My Missions (Pro)</button>
            ) : (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { loadAdminCustomMissions(); setView('missions'); }}>✏️ My Missions</button>
            )}
```

Replace the pro branch only:
```typescript
            {plan === 'free' ? (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px', color: '#7CBDD4', border: '1px solid rgba(124,189,212,0.3)' }} onClick={() => handleUpgrade('pro')} disabled={upgradeLoading}>🔒 My Missions (Pro)</button>
            ) : (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { loadAdminCustomMissions(); setView('missions'); }}>✏️ My Missions</button>
                <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px', color: '#7CBDD4', border: '1px solid rgba(124,189,212,0.3)' }} onClick={() => { loadAdminCustomMissions(); setView('missions'); setAiPanelOpen(true); }}>✨ Generate</button>
              </div>
            )}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Manual test — Pro plan**

1. Log in as a Pro admin
2. Go to games list → click "✨ Generate"
3. Verify My Missions view opens with AI panel already expanded
4. Type: "5 trivia questions about football" → click Generate
5. Verify mission form opens pre-filled with 5 trivia questions
6. Try with type = "timeline" and prompt = "Apple product history"
7. Verify timeline items are in the form
8. Save — verify mission appears in My Missions list

- [ ] **Step 9: Manual test — Free plan**

1. Log in as a free plan admin
2. Go to My Missions view
3. Click "✨ Generate with AI"
4. Verify AI panel opens but after clicking Generate shows "pro_required" upgrade nudge

- [ ] **Step 10: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add AI mission generator panel to admin dashboard"
```
