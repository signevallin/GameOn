# Enhanced Game Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seasonal date-range visibility, AI-suggested descriptions, and full AI-generated templates (with new mission creation) to GameOn's template system.

**Architecture:** Extend `game_templates` with `active_from`/`active_to` TEXT columns (MM-DD format). Add a pure utility `lib/template-utils.ts` for date logic. Add two new API endpoints: `/describe` and `/generate`. Update existing template API routes and the `manage-templates` / `templates` UI in AdminScreen.

**Tech Stack:** Next.js App Router, Supabase service role, Anthropic SDK (claude-haiku-4-5 for describe, claude-sonnet-4-6 for generate), React inline styles (existing pattern)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/templates.ts` | Modify | Add `activeFrom`/`activeTo` fields to interface + `toGameTemplate` |
| `lib/template-utils.ts` | Create | `isTemplateActive(activeFrom, activeTo, today?)` — pure date logic |
| `app/api/admin/templates/route.ts` | Modify | Filter inactive templates for non-superadmins; accept new fields |
| `app/api/admin/templates/[id]/route.ts` | Modify | Accept and persist `activeFrom`/`activeTo` in PUT |
| `app/api/admin/templates/describe/route.ts` | Create | AI description suggestion |
| `app/api/admin/templates/generate/route.ts` | Create | Full AI template generation |
| `components/screens/AdminScreen.tsx` | Modify | Description + date range fields in forms; Generate modal |

---

### Task 1: DB migration — add active_from / active_to to game_templates

**Files:**
- Supabase SQL console (no file — run directly in Supabase dashboard)

- [ ] **Step 1: Run migration SQL in Supabase**

Open the Supabase dashboard → SQL Editor and run:

```sql
ALTER TABLE game_templates
  ADD COLUMN IF NOT EXISTS active_from TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS active_to   TEXT DEFAULT NULL;
```

- [ ] **Step 2: Verify columns exist**

Run in SQL Editor:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'game_templates'
  AND column_name IN ('active_from', 'active_to');
```

Expected output: 2 rows, both `text` type, default `NULL`.

- [ ] **Step 3: Commit a note**

```bash
git commit --allow-empty -m "feat: add active_from/active_to columns to game_templates (via Supabase dashboard)"
```

---

### Task 2: Update lib/templates.ts and create lib/template-utils.ts

**Files:**
- Modify: `lib/templates.ts`
- Create: `lib/template-utils.ts`

- [ ] **Step 1: Update `lib/templates.ts`**

Replace the file content with:

```typescript
// lib/templates.ts

export interface GameTemplate {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  missionIds: string[];
  isBuiltin: boolean;
  userId: string | null;
  createdAt: string;
  activeFrom: string | null; // "MM-DD", e.g. "10-01"
  activeTo: string | null;   // "MM-DD", e.g. "10-31"
}

// Converts a raw Supabase DB row (snake_case) to GameTemplate (camelCase)
export function toGameTemplate(row: Record<string, unknown>): GameTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    icon: row.icon as string,
    description: row.description as string | null,
    missionIds: row.mission_ids as string[],
    isBuiltin: row.is_builtin as boolean,
    userId: row.user_id as string | null,
    createdAt: row.created_at as string,
    activeFrom: row.active_from as string | null,
    activeTo: row.active_to as string | null,
  };
}
```

- [ ] **Step 2: Create `lib/template-utils.ts`**

```typescript
// lib/template-utils.ts

/**
 * Returns true if `today` falls within the [activeFrom, activeTo] MM-DD range.
 * If either is null/undefined, the template is always active.
 * Supports ranges that cross the new year (e.g. "12-20" → "01-05").
 *
 * @param activeFrom  "MM-DD" string or null
 * @param activeTo    "MM-DD" string or null
 * @param today       optional Date for testing; defaults to new Date()
 */
export function isTemplateActive(
  activeFrom: string | null | undefined,
  activeTo: string | null | undefined,
  today: Date = new Date()
): boolean {
  if (!activeFrom || !activeTo) return true;

  const pad = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  if (activeFrom <= activeTo) {
    // Same-year range: e.g. "10-01" to "10-31"
    return todayStr >= activeFrom && todayStr <= activeTo;
  } else {
    // Crosses new year: e.g. "12-20" to "01-05"
    return todayStr >= activeFrom || todayStr <= activeTo;
  }
}
```

- [ ] **Step 3: Type-check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `lib/templates.ts` or `lib/template-utils.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/templates.ts lib/template-utils.ts
git commit -m "feat: add activeFrom/activeTo to GameTemplate type and isTemplateActive utility"
```

---

### Task 3: Update existing templates API routes

**Files:**
- Modify: `app/api/admin/templates/route.ts`
- Modify: `app/api/admin/templates/[id]/route.ts`

- [ ] **Step 1: Replace `app/api/admin/templates/route.ts`**

```typescript
// app/api/admin/templates/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { toGameTemplate } from '@/lib/templates';
import { isTemplateActive } from '@/lib/template-utils';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const db = adminClient();
  const [builtinsResult, ownResult] = await Promise.all([
    db.from('game_templates').select('*').eq('is_builtin', true).order('created_at'),
    db.from('game_templates').select('*').eq('is_builtin', false).eq('user_id', admin.userId).order('created_at', { ascending: false }),
  ]);

  if (builtinsResult.error) return NextResponse.json({ error: builtinsResult.error.message }, { status: 500 });
  if (ownResult.error) return NextResponse.json({ error: ownResult.error.message }, { status: 500 });

  const all = [
    ...(builtinsResult.data || []).map(toGameTemplate),
    ...(ownResult.data || []).map(toGameTemplate),
  ];

  // Non-superadmins only see templates that are currently active
  const templates = admin.isSuperAdmin
    ? all
    : all.filter(t => isTemplateActive(t.activeFrom, t.activeTo));

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { name, icon, description, missionIds, isBuiltin, activeFrom, activeTo } = await req.json();
  if (!name || !Array.isArray(missionIds) || missionIds.length === 0) {
    return NextResponse.json({ error: 'name and missionIds are required' }, { status: 400 });
  }
  if (isBuiltin && !admin.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Validate MM-DD format if provided
  const mmddRe = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (activeFrom && !mmddRe.test(activeFrom)) {
    return NextResponse.json({ error: 'activeFrom must be MM-DD' }, { status: 400 });
  }
  if (activeTo && !mmddRe.test(activeTo)) {
    return NextResponse.json({ error: 'activeTo must be MM-DD' }, { status: 400 });
  }

  const db = adminClient();
  const { data, error } = await db
    .from('game_templates')
    .insert({
      name,
      icon: icon || '🎮',
      description: description || null,
      mission_ids: missionIds,
      is_builtin: isBuiltin ?? false,
      user_id: isBuiltin ? null : admin.userId,
      active_from: activeFrom || null,
      active_to: activeTo || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: toGameTemplate(data) });
}
```

- [ ] **Step 2: Update `app/api/admin/templates/[id]/route.ts`** — add `activeFrom`/`activeTo` to PUT

Replace the `PUT` handler's `updates` block (lines 32–36) with:

```typescript
  const body = await req.json();
  const mmddRe = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.icon !== undefined) updates.icon = body.icon;
  if (body.description !== undefined) updates.description = body.description;
  if (body.missionIds !== undefined) updates.mission_ids = body.missionIds;
  if (body.activeFrom !== undefined) {
    if (body.activeFrom !== null && !mmddRe.test(body.activeFrom)) {
      return NextResponse.json({ error: 'activeFrom must be MM-DD' }, { status: 400 });
    }
    updates.active_from = body.activeFrom;
  }
  if (body.activeTo !== undefined) {
    if (body.activeTo !== null && !mmddRe.test(body.activeTo)) {
      return NextResponse.json({ error: 'activeTo must be MM-DD' }, { status: 400 });
    }
    updates.active_to = body.activeTo;
  }
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/templates/route.ts app/api/admin/templates/[id]/route.ts
git commit -m "feat: filter seasonal templates for non-superadmins; accept activeFrom/activeTo in templates API"
```

---

### Task 4: Create POST /api/admin/templates/describe

**Files:**
- Create: `app/api/admin/templates/describe/route.ts`

- [ ] **Step 1: Create the file**

```typescript
// app/api/admin/templates/describe/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

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
  const { data: customMissions } = await db
    .from('custom_missions')
    .select('id, name')
    .in('id', missionIds);

  const missionNames = (customMissions ?? []).map(m => m.name);

  const prompt = `You write short descriptions for game templates in an event management app.

Template name: "${name}"
Missions included: ${missionNames.length > 0 ? missionNames.join(', ') : 'various missions'}

Write a 1-2 sentence description for event organizers explaining what this template is good for and what makes it fun. Be concise and energetic. Return ONLY the description text, no quotes.`;

  try {
    const response = await client.messages.create({
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start dev server (`npm run dev`), then in a browser console or with curl (replace `TOKEN` with a valid admin session token):

```bash
curl -X POST http://localhost:3000/api/admin/templates/describe \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name":"Halloween Hunt","missionIds":[]}'
```

Expected: `{"description":"..."}` — a short 1-2 sentence description.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/templates/describe/route.ts
git commit -m "feat: add POST /api/admin/templates/describe endpoint for AI description suggestions"
```

---

### Task 5: Create POST /api/admin/templates/generate

**Files:**
- Create: `app/api/admin/templates/generate/route.ts`

- [ ] **Step 1: Create the file**

```typescript
// app/api/admin/templates/generate/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { createClient } from '@supabase/supabase-js';
import { MISSIONS } from '@/lib/missions';

export const dynamic = 'force-dynamic';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function parseJSON(text: string): Record<string, unknown> | null {
  const stripped = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
  try { return JSON.parse(stripped); } catch { return null; }
}

export interface GeneratedMission {
  title: string;
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

  const body = await req.json();
  const { prompt } = body as { prompt?: string };

  if (!prompt?.trim()) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  // Build mission pool: static built-ins + admin's custom missions
  const db = adminClient();
  const { data: customMissions } = await db
    .from('custom_missions')
    .select('id, name, type, max_pts')
    .eq('user_id', admin.userId);

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

  const systemPrompt = `You generate game templates for GameOn, a team event platform.

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
      "type": "photo | trivia_quiz | truefalse | closest_wins | timeline | pa_sparet",
      "points": 300,
      "description": "One sentence: what teams must do"
    }
  ]
}

Rules:
- Select 6-12 missions from the pool that best fit the event. Prefer existing missions when they fit.
- Only add newMissions when the pool lacks enough suitable missions for the theme (target: at least 3 new if theme is very specific).
- newMissions.points: 200-600 depending on difficulty.
- Set activeFrom/activeTo only for clearly seasonal events (Halloween, Christmas, summer, etc.).
- Return ONLY the JSON object.`;

  const userMessage = `Event description: ${prompt.trim()}\n\nMission pool:\n${missionPoolText}`;

  let raw: string;
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
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

  return NextResponse.json(parsed as GeneratedTemplate);
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

```bash
curl -X POST http://localhost:3000/api/admin/templates/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"prompt":"Halloween scavenger hunt for 8 teams, spooky and fun, 45 minutes"}'
```

Expected: a JSON object with `name`, `icon`, `description`, `activeFrom`, `activeTo`, `selectedMissionIds`, and `newMissions` array.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/templates/generate/route.ts
git commit -m "feat: add POST /api/admin/templates/generate endpoint for AI template generation"
```

---

### Task 6: Update manage-templates UI (description field + date range pickers)

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

This task adds two new fields to both the "New template" form and each template's edit form in the `manage-templates` view.

Context: the manage-templates view starts at `if (view === 'manage-templates') return (` around line 3457. The `showNewTemplateForm` block is around line 3475. Edit forms are inside `.filter(t => t.isBuiltin).map(t => ...)` around line 3528.

- [ ] **Step 1: Add new state variables**

Find the block of template state variables (around line 879–893). After `const [manageTemplatesLoading, setManageTemplatesLoading] = useState(false);` add:

```typescript
  // New template form — extra fields
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [newTemplateActiveFrom, setNewTemplateActiveFrom] = useState('');
  const [newTemplateActiveTo, setNewTemplateActiveTo] = useState('');
  const [newTemplateDescLoading, setNewTemplateDescLoading] = useState(false);

  // Edit template form — extra fields
  const [editTemplateDesc, setEditTemplateDesc] = useState('');
  const [editTemplateActiveFrom, setEditTemplateActiveFrom] = useState('');
  const [editTemplateActiveTo, setEditTemplateActiveTo] = useState('');
  const [editTemplateDescLoading, setEditTemplateDescLoading] = useState(false);
```

- [ ] **Step 2: Add AI describe helper function**

Add this function after `deleteBuiltinTemplate` (around line 1556):

```typescript
  async function suggestTemplateDescription(
    name: string,
    missionIds: string[],
    setter: (v: string) => void,
    setLoading: (v: boolean) => void
  ) {
    setLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/admin/templates/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ name, missionIds }),
      });
      const data = await res.json();
      if (data.description) setter(data.description);
      else showToast('Could not generate description', 'error');
    } catch {
      showToast('Could not generate description', 'error');
    } finally {
      setLoading(false);
    }
  }
```

- [ ] **Step 3: Update `createBuiltinTemplate` to accept description + dates**

Find `createBuiltinTemplate` (around line 1558). Change its signature and body:

```typescript
  async function createBuiltinTemplate(
    name: string, icon: string, missionIds: string[],
    description: string, activeFrom: string, activeTo: string
  ) {
    setManageTemplatesLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          name, icon, missionIds, isBuiltin: true,
          description: description || null,
          activeFrom: activeFrom || null,
          activeTo: activeTo || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create template');
      const { template } = await res.json();
      setTemplates(prev => [template, ...prev]);
      setShowNewTemplateForm(false);
      setNewTemplateName('');
      setNewTemplateIcon('🎮');
      setNewTemplateMissions([]);
      setNewTemplateDesc('');
      setNewTemplateActiveFrom('');
      setNewTemplateActiveTo('');
      showToast('Template created');
    } catch (err) {
      console.error('Failed to create template:', err);
      showToast('Failed to create template', 'error');
    } finally {
      setManageTemplatesLoading(false);
    }
  }
```

- [ ] **Step 4: Update `updateBuiltinTemplate` to accept description + dates**

Find `updateBuiltinTemplate` (around line 1519). Change its signature and PUT body:

```typescript
  async function updateBuiltinTemplate(
    id: string, name: string, icon: string, missionIds: string[],
    description: string, activeFrom: string, activeTo: string
  ) {
    setEditTemplateLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/api/admin/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          name, icon, missionIds,
          description: description || null,
          activeFrom: activeFrom || null,
          activeTo: activeTo || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update template');
      const { template } = await res.json();
      setTemplates(prev => prev.map(t => t.id === id ? template : t));
      setEditingTemplateId(null);
      showToast('Template updated');
    } catch (err) {
      console.error('Failed to update template:', err);
      showToast('Failed to update template');
    } finally {
      setEditTemplateLoading(false);
    }
  }
```

- [ ] **Step 5: Add description + date fields to the "New template" form**

Inside the `{showNewTemplateForm && (` block, after the missions selector and before the Save button, add:

```tsx
{/* Description with AI suggest */}
<div style={{ marginTop: 10 }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
    <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700 }}>Description</span>
    <button
      onClick={() => suggestTemplateDescription(newTemplateName, newTemplateMissions, setNewTemplateDesc, setNewTemplateDescLoading)}
      disabled={newTemplateDescLoading || !newTemplateName.trim() || newTemplateMissions.length === 0}
      style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", opacity: (!newTemplateName.trim() || newTemplateMissions.length === 0) ? 0.5 : 1 }}
    >
      {newTemplateDescLoading ? '...' : '✨ Suggest'}
    </button>
  </div>
  <textarea
    value={newTemplateDesc}
    onChange={e => setNewTemplateDesc(e.target.value)}
    placeholder="What's this template about?"
    rows={3}
    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '13px', fontFamily: "'Sora', sans-serif", resize: 'vertical' }}
  />
</div>

{/* Seasonal date range */}
<div style={{ marginTop: 10 }}>
  <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, marginBottom: 6 }}>Show only between (optional)</div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>From</span>
    <input
      type="text"
      value={newTemplateActiveFrom}
      onChange={e => setNewTemplateActiveFrom(e.target.value)}
      placeholder="MM-DD"
      maxLength={5}
      style={{ width: 70, padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '13px', fontFamily: "'Sora', sans-serif" }}
    />
    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>To</span>
    <input
      type="text"
      value={newTemplateActiveTo}
      onChange={e => setNewTemplateActiveTo(e.target.value)}
      placeholder="MM-DD"
      maxLength={5}
      style={{ width: 70, padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '13px', fontFamily: "'Sora', sans-serif" }}
    />
  </div>
</div>
```

Also update the Save button's `onClick` to pass the new fields:

```tsx
onClick={() => createBuiltinTemplate(newTemplateName, newTemplateIcon, newTemplateMissions, newTemplateDesc, newTemplateActiveFrom, newTemplateActiveTo)}
```

- [ ] **Step 6: Pre-fill edit form state when opening edit**

Find where `setEditingTemplateId(t.id)` is called (around line 3557 area). Add alongside it:

```tsx
setEditTemplateDesc(t.description ?? '');
setEditTemplateActiveFrom(t.activeFrom ?? '');
setEditTemplateActiveTo(t.activeTo ?? '');
```

- [ ] **Step 7: Add description + date fields to the edit form**

Inside the edit form (inside `.filter(t => t.isBuiltin).map(t => ...)`), after the missions selector and before the SAVE button, add the same description + date range fields as in Step 5, but using `editTemplateDesc/setEditTemplateDesc`, `editTemplateActiveFrom/setEditTemplateActiveFrom`, `editTemplateActiveTo/setEditTemplateActiveTo`, `editTemplateDescLoading/setEditTemplateDescLoading`, and `editTemplateMissions` for the describe call.

Also update the SAVE button's `onClick`:

```tsx
onClick={() => updateBuiltinTemplate(t.id, editTemplateName, editTemplateIcon, editTemplateMissions, editTemplateDesc, editTemplateActiveFrom, editTemplateActiveTo)}
```

- [ ] **Step 8: Show seasonal badge on template cards**

In the templates view (around line 3627), inside `.filter(t => t.isBuiltin).map(t => ...)` and in `templates.filter(t => !t.isBuiltin).map(t => ...)`, add a badge after the template name if `t.activeFrom`:

```tsx
{t.activeFrom && t.activeTo && (
  <span style={{ fontSize: '10px', color: 'var(--accent)', background: 'rgba(117,171,200,0.1)', border: '1px solid rgba(117,171,200,0.2)', borderRadius: '4px', padding: '1px 6px', marginLeft: 6 }}>
    🗓 {t.activeFrom} – {t.activeTo}
  </span>
)}
```

- [ ] **Step 9: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add description + seasonal date fields to manage-templates UI"
```

---

### Task 7: Add "Generate with AI" modal to templates view

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

- [ ] **Step 1: Add AI generate state variables**

After the existing template state variables, add:

```typescript
  // AI generate modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generatePreview, setGeneratePreview] = useState<{
    name: string; icon: string; description: string;
    activeFrom: string | null; activeTo: string | null;
    selectedMissionIds: string[]; newMissions: Array<{ title: string; type: string; points: number; description: string }>;
  } | null>(null);
  const [generateSaving, setGenerateSaving] = useState(false);
```

- [ ] **Step 2: Add `generateTemplate` function**

Add after `suggestTemplateDescription`:

```typescript
  async function generateTemplate() {
    if (!generatePrompt.trim()) return;
    setGenerateLoading(true);
    setGeneratePreview(null);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/admin/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ prompt: generatePrompt }),
      });
      if (!res.ok) throw new Error('generation_failed');
      const data = await res.json();
      setGeneratePreview(data);
    } catch {
      showToast('Could not generate template', 'error');
    } finally {
      setGenerateLoading(false);
    }
  }

  async function saveGeneratedTemplate() {
    if (!generatePreview) return;
    setGenerateSaving(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const token = session?.access_token;

      // Create new missions first
      const createdIds: string[] = [];
      for (const nm of generatePreview.newMissions) {
        const res = await fetch('/api/admin/custom-missions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: nm.title, type: nm.type, max_pts: nm.points, desc: nm.description, icon: '⭐', difficulty: 'medium', data: {} }),
        });
        if (!res.ok) throw new Error('Failed to create mission');
        const { mission } = await res.json();
        createdIds.push(mission.id);
      }

      const allMissionIds = [...generatePreview.selectedMissionIds, ...createdIds];

      // Save template
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: generatePreview.name,
          icon: generatePreview.icon,
          description: generatePreview.description,
          missionIds: allMissionIds,
          isBuiltin: false,
          activeFrom: generatePreview.activeFrom,
          activeTo: generatePreview.activeTo,
        }),
      });
      if (!res.ok) throw new Error('Failed to save template');
      const { template } = await res.json();
      setTemplates(prev => [...prev, template]);
      setShowGenerateModal(false);
      setGeneratePrompt('');
      setGeneratePreview(null);
      showToast('Template created!');
    } catch (err) {
      console.error(err);
      showToast('Failed to save template', 'error');
    } finally {
      setGenerateSaving(false);
    }
  }
```

- [ ] **Step 3: Add the Generate modal JSX**

Find the `if (view === 'templates') return (` block (around line 3606). Just before the `return (` add the modal (it renders as a fixed overlay):

```tsx
{showGenerateModal && (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520, fontFamily: "'Sora', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)' }}>✨ Generate with AI</div>
        <button onClick={() => { setShowGenerateModal(false); setGeneratePreview(null); setGeneratePrompt(''); }} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>✕</button>
      </div>

      {!generatePreview ? (
        <>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>Describe your event — theme, duration, number of teams, vibe...</p>
          <textarea
            value={generatePrompt}
            onChange={e => setGeneratePrompt(e.target.value)}
            placeholder="e.g. Halloween scavenger hunt for 8 teams, spooky and competitive, around 45 minutes"
            rows={4}
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13, fontFamily: "'Sora', sans-serif", resize: 'vertical' }}
          />
          <button
            onClick={generateTemplate}
            disabled={generateLoading || !generatePrompt.trim()}
            style={{ marginTop: 12, width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0a0e19', fontWeight: 800, fontSize: 14, cursor: generateLoading || !generatePrompt.trim() ? 'not-allowed' : 'pointer', opacity: !generatePrompt.trim() ? 0.5 : 1, fontFamily: "'Sora', sans-serif" }}
          >
            {generateLoading ? 'Generating...' : 'Generate →'}
          </button>
        </>
      ) : (
        <>
          {/* Preview */}
          <div style={{ background: 'var(--bg)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 24 }}>{generatePreview.icon}</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{generatePreview.name}</div>
                {generatePreview.activeFrom && generatePreview.activeTo && (
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 2 }}>🗓 {generatePreview.activeFrom} – {generatePreview.activeTo}</div>
                )}
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }}>{generatePreview.description}</p>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
              Missions ({generatePreview.selectedMissionIds.length + generatePreview.newMissions.length} total)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
              {generatePreview.newMissions.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(117,171,200,0.15)', color: 'var(--accent)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>NEW</span>
                  {m.title}
                </div>
              ))}
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>+ {generatePreview.selectedMissionIds.length} existing missions</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setGeneratePreview(null)}
              style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
            >
              ← Back
            </button>
            <button
              onClick={saveGeneratedTemplate}
              disabled={generateSaving}
              style={{ flex: 2, padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#0a0e19', fontWeight: 800, fontSize: 13, cursor: generateSaving ? 'not-allowed' : 'pointer', fontFamily: "'Sora', sans-serif" }}
            >
              {generateSaving ? 'Saving...' : 'Save template'}
            </button>
          </div>
        </>
      )}
    </div>
  </div>
)}
```

- [ ] **Step 4: Add "Generate with AI" button to templates view header**

Inside `if (view === 'templates') return (`, find the view header area. Add the button next to the back/nav buttons:

```tsx
<button
  onClick={() => setShowGenerateModal(true)}
  style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
>
  ✨ Generate with AI
</button>
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Manual end-to-end test**

1. Open admin UI → Templates view
2. Click "✨ Generate with AI"
3. Type: "Christmas party for 6 teams, festive and competitive, 30 minutes"
4. Click Generate — should show spinner, then preview with name/icon/description/missions
5. New missions should have "NEW" badge
6. Click "Save template" — should show success toast, template appears in My Templates
7. Click the template — should pre-fill the create-game form
8. Go to manage-templates → create a new template → click "✨ Suggest" on description → description auto-fills
9. Set activeFrom "12-01", activeTo "12-31" → save → template appears with 🗓 badge

- [ ] **Step 7: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add AI generate template modal with mission creation and preview"
```
