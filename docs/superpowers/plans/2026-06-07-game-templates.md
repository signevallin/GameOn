# Game Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins start game creation from a pre-selected mission list; built-in templates ship in the DB, admins save their own, and superadmins can manage built-in templates from a dedicated page.

**Architecture:** A new `game_templates` Supabase table stores all templates (`is_builtin` flag, `user_id` nullable). Three API routes handle CRUD. AdminScreen gains two new views: `templates` (library shown before create-game) and `manage-templates` (superadmin only, accessible from games list). Mission pre-fill works by setting `selectedMissions` state before navigating to `view = 'create'`.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (PostgreSQL + RLS), React hooks

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260607_game_templates.sql` | Create | Table DDL, RLS policies, seed data |
| `lib/templates.ts` | Create | `GameTemplate` type + `toGameTemplate` row mapper |
| `app/api/admin/templates/route.ts` | Create | GET (list), POST (create) |
| `app/api/admin/templates/[id]/route.ts` | Create | PUT (update), DELETE (delete) |
| `components/screens/AdminScreen.tsx` | Modify | Two new views, save-as-template button, mission pre-fill |

---

### Task 1: Supabase migration — `game_templates` table + seed data

**Files:**
- Create: `supabase/migrations/20260607_game_templates.sql`

No test framework — verify by querying the table after applying.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260607_game_templates.sql

-- Game templates table
create table if not exists public.game_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  icon         text not null default '🎮',
  description  text,
  mission_ids  text[] not null default '{}',
  is_builtin   boolean not null default false,
  user_id      uuid references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- Index for fast per-user lookups
create index if not exists game_templates_user_id_idx
  on public.game_templates (user_id);

-- RLS
alter table public.game_templates enable row level security;

-- All authenticated users can read all templates
create policy "read all templates"
  on public.game_templates for select
  using (auth.uid() is not null);

-- Admins can insert their own non-builtin templates
create policy "insert own templates"
  on public.game_templates for insert
  with check (auth.uid() = user_id and is_builtin = false);

-- Admins can update their own non-builtin templates
create policy "update own templates"
  on public.game_templates for update
  using (auth.uid() = user_id and is_builtin = false);

-- Admins can delete their own non-builtin templates
create policy "delete own templates"
  on public.game_templates for delete
  using (auth.uid() = user_id and is_builtin = false);

-- Seed: built-in templates (service role bypasses RLS for these)
insert into public.game_templates (name, icon, description, mission_ids, is_builtin, user_id) values
(
  'After Work',
  '🍻',
  'Relaxed social mix with quiz, photo, and music rounds',
  array['trivia_fun','wouldyou','photo_bubble','photo_movie_scene','music_quiz','finish_lyrics','music_emoji','mix_drinks','celebrity_quiz','movie_emoji','logo_quiz','pictionary','duel_trivia','closest_wins'],
  true,
  null
),
(
  'IT Onboarding',
  '💻',
  'Tech-focused with coding challenges, trivia, and logic puzzles',
  array['code_quiz','binary','bug_hunt','terminal','app_icons','spot_error','typerace','wordguess','anagram','true_false','timeline','trivia_fun'],
  true,
  null
),
(
  'Team Kickoff',
  '🎉',
  'High-energy team-builder with photo challenges, duels, and scavenger hunt',
  array['human_statue','photo_mirror_selfie','photo_ad_shot','photo_colour_match','photo_weird_sign','reaction','memory','wouldyou','scavenger_hunt','duel_trivia','geo_guess','emoji_rebus','flag_quiz'],
  true,
  null
);
```

- [ ] **Step 2: Apply the migration**

```bash
cd /Users/signevallin/Desktop/GameOn && npx supabase db push
```

If `supabase db push` is not available, open the Supabase Dashboard → SQL Editor and paste the contents of the file. Run it.

- [ ] **Step 3: Verify the table and seed data exist**

```bash
cd /Users/signevallin/Desktop/GameOn && npx supabase db diff 2>/dev/null || echo "manual verify needed"
```

Or in the Supabase Dashboard SQL Editor run:
```sql
select name, is_builtin, array_length(mission_ids, 1) as mission_count from public.game_templates order by created_at;
```
Expected: 3 rows — After Work (14), IT Onboarding (12), Team Kickoff (13).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260607_game_templates.sql
git commit -m "feat: add game_templates table with RLS and built-in seed data"
```

---

### Task 2: TypeScript type + API routes

**Files:**
- Create: `lib/templates.ts`
- Create: `app/api/admin/templates/route.ts`
- Create: `app/api/admin/templates/[id]/route.ts`

No test framework — verify with TypeScript check and curl.

- [ ] **Step 1: Create `lib/templates.ts`**

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
  };
}
```

- [ ] **Step 2: Create `app/api/admin/templates/route.ts`**

```typescript
// app/api/admin/templates/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { toGameTemplate } from '@/lib/templates';

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

  const templates = [
    ...(builtinsResult.data || []).map(toGameTemplate),
    ...(ownResult.data || []).map(toGameTemplate),
  ];

  return NextResponse.json({ templates });
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { name, icon, description, missionIds, isBuiltin } = await req.json();
  if (!name || !Array.isArray(missionIds) || missionIds.length === 0) {
    return NextResponse.json({ error: 'name and missionIds are required' }, { status: 400 });
  }
  if (isBuiltin && !admin.isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: toGameTemplate(data) });
}
```

- [ ] **Step 3: Create `app/api/admin/templates/[id]/route.ts`**

```typescript
// app/api/admin/templates/[id]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { toGameTemplate } from '@/lib/templates';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const db = adminClient();
  const { data: existing, error: fetchErr } = await db
    .from('game_templates')
    .select('*')
    .eq('id', params.id)
    .single();

  if (fetchErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.is_builtin && !admin.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!existing.is_builtin && existing.user_id !== admin.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.icon !== undefined) updates.icon = body.icon;
  if (body.description !== undefined) updates.description = body.description;
  if (body.missionIds !== undefined) updates.mission_ids = body.missionIds;

  const { data, error } = await db
    .from('game_templates')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: toGameTemplate(data) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const admin = await validateAdminToken(_req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const db = adminClient();
  const { data: existing, error: fetchErr } = await db
    .from('game_templates')
    .select('id, is_builtin, user_id')
    .eq('id', params.id)
    .single();

  if (fetchErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.is_builtin && !admin.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!existing.is_builtin && existing.user_id !== admin.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { error } = await db.from('game_templates').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/templates.ts app/api/admin/templates/route.ts app/api/admin/templates/[id]/route.ts
git commit -m "feat: add GameTemplate type and CRUD API routes"
```

---

### Task 3: Template library view in AdminScreen

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

- [ ] **Step 1: Add import and update AdminView type**

At the top of the file, add the import alongside other lib imports:
```typescript
import type { GameTemplate } from '@/lib/templates';
```

Find (line 312):
```typescript
type AdminView = 'games' | 'create' | 'dashboard' | 'missions';
```
Replace with:
```typescript
type AdminView = 'games' | 'create' | 'dashboard' | 'missions' | 'templates' | 'manage-templates';
```

- [ ] **Step 2: Add templates state and loadTemplates function**

Find the `const [isSuperAdmin, setIsSuperAdmin] = useState(false);` line (around line 402). Add after it:

```typescript
  const [templates, setTemplates] = useState<GameTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
```

Find the `loadAnalytics` function (around line 750). Add the following new function directly after it (or before it — any clear location inside the component body):

```typescript
  async function loadTemplates() {
    setTemplatesLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/admin/templates', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  }
```

- [ ] **Step 3: Add the templates view JSX**

Find the line (around line 1313):
```typescript
  if (view === 'create') return (
```

Insert the following block **immediately before** that line:

```tsx
  if (view === 'templates') return (
    <>
      <nav className="nav" style={{ position: 'relative' }}>
        <div className="nav-brand"><GameOnLogo size={22} /></div>
        <div className="nav-right">
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => setView('games')}>← BACK</button>
        </div>
      </nav>
      <div className="container fade-in" style={{ maxWidth: '680px' }}>
        <div style={{ padding: '32px 0 24px' }}>
          <h2 style={{ margin: '0 0 4px' }}>Choose a starting point</h2>
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>Pick a template or start from scratch</p>
        </div>

        {templatesLoading ? (
          <div style={{ color: 'var(--muted)', fontSize: '14px', padding: '40px 0', textAlign: 'center' }}>Loading templates...</div>
        ) : (
          <>
            {/* Built-in templates */}
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Built-in templates</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {templates.filter(t => t.isBuiltin).map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedMissions(t.missionIds); setView('create'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <span style={{ fontSize: '28px', flexShrink: 0 }}>{t.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{t.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{t.missionIds.length} missions{t.description ? ` · ${t.description}` : ''}</div>
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: '18px' }}>→</span>
                </button>
              ))}
            </div>

            {/* My templates */}
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '12px' }}>My templates</div>
            {templates.filter(t => !t.isBuiltin).length === 0 ? (
              <div style={{ background: 'var(--card)', border: '1px dashed var(--border)', borderRadius: '12px', padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', marginBottom: '24px' }}>
                No saved templates yet — save a game as a template from the games list
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {templates.filter(t => !t.isBuiltin).map(t => (
                  <div
                    key={t.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px' }}
                  >
                    <button
                      onClick={() => { setSelectedMissions(t.missionIds); setView('create'); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                    >
                      <span style={{ fontSize: '24px', flexShrink: 0 }}>{t.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{t.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{t.missionIds.length} missions</div>
                      </div>
                      <span style={{ color: 'var(--muted)', fontSize: '18px' }}>→</span>
                    </button>
                    <button
                      onClick={async () => {
                        const session = (await supabase.auth.getSession()).data.session;
                        await fetch(`/api/admin/templates/${t.id}`, {
                          method: 'DELETE',
                          headers: { Authorization: `Bearer ${session?.access_token}` },
                        });
                        setTemplates(prev => prev.filter(x => x.id !== t.id));
                      }}
                      title="Delete template"
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Blank game */}
            <button
              onClick={() => { setSelectedMissions(MISSIONS.map(m => m.id)); setView('create'); }}
              style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <span style={{ fontSize: '28px', flexShrink: 0 }}>✏️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>Blank game</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>Choose missions manually</div>
              </div>
              <span style={{ color: 'var(--muted)', fontSize: '18px' }}>→</span>
            </button>
          </>
        )}
      </div>
    </>
  );
```

- [ ] **Step 4: Wire up "+ NEW GAME" button to go to templates view**

Find (around line 868):
```tsx
            <button className="btn btn-primary" onClick={() => setView('create')}>+ NEW GAME</button>
```

Replace with:
```tsx
            <button className="btn btn-primary" onClick={() => { loadTemplates(); setView('templates'); }}>+ NEW GAME</button>
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add template library view and wire up NEW GAME button"
```

---

### Task 4: Save as template button on game cards

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

- [ ] **Step 1: Add save-template state**

Find the `const [templatesLoading, setTemplatesLoading] = useState(false);` line added in Task 3. Add directly after it:

```typescript
  const [saveTemplateId, setSaveTemplateId] = useState<string | null>(null);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [saveTemplateIcon, setSaveTemplateIcon] = useState('🎮');
  const [saveTemplateLoading, setSaveTemplateLoading] = useState(false);
```

- [ ] **Step 2: Add saveAsTemplate function**

Add this function alongside `loadTemplates`:

```typescript
  async function saveAsTemplate(gameId: string, name: string, icon: string, missionIds: string[]) {
    setSaveTemplateLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ name, icon, missionIds, isBuiltin: false }),
      });
      if (!res.ok) throw new Error('Failed to save template');
      setSaveTemplateId(null);
      setSaveTemplateName('');
      setSaveTemplateIcon('🎮');
      showToast('Template saved!');
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setSaveTemplateLoading(false);
    }
  }
```

Note: `showToast` is the existing toast function in AdminScreen. Find its name by searching for existing toast calls (e.g. search for `showToast(` or `setToast(`). Use whatever the existing pattern is.

- [ ] **Step 3: Add "Save as template" button to each game card**

In the game card's right-side action area, find the non-confirming state of the delete button (around line 927):
```tsx
                  ) : (
                    <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(g.id); }}
                      title="Delete game"
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>
                      🗑
                    </button>
                  )}
```

Replace the non-confirming branch with:
```tsx
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setSaveTemplateId(g.id); setSaveTemplateName(g.name || 'My Template'); setSaveTemplateIcon('🎮'); }}
                          title="Save as template"
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '13px', lineHeight: 1, flexShrink: 0, fontFamily: "'Sora', sans-serif", fontWeight: 600 }}
                        >
                          Save as template
                        </button>
                        <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(g.id); }}
                          title="Delete game"
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>
                          🗑
                        </button>
                      </div>
                      {saveTemplateId === g.id && (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                          <input
                            value={saveTemplateIcon}
                            onChange={e => setSaveTemplateIcon(e.target.value)}
                            style={{ width: '36px', padding: '5px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '16px', textAlign: 'center', fontFamily: "'Sora', sans-serif" }}
                          />
                          <input
                            value={saveTemplateName}
                            onChange={e => setSaveTemplateName(e.target.value)}
                            placeholder="Template name"
                            style={{ width: '150px', padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '12px', fontFamily: "'Sora', sans-serif" }}
                          />
                          <button
                            onClick={() => saveAsTemplate(g.id, saveTemplateName, saveTemplateIcon, g.missions)}
                            disabled={saveTemplateLoading || !saveTemplateName.trim()}
                            style={{ padding: '5px 12px', borderRadius: '6px', border: 'none', background: 'var(--accent)', color: '#0a0e19', fontWeight: 700, fontSize: '11px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                          >
                            {saveTemplateLoading ? '...' : 'SAVE'}
                          </button>
                          <button
                            onClick={() => setSaveTemplateId(null)}
                            style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '11px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  )}
```

- [ ] **Step 4: Check showToast name**

Search for the toast pattern:
```bash
grep -n "showToast\|setToast\|toast(" /Users/signevallin/Desktop/GameOn/components/screens/AdminScreen.tsx | head -10
```

If the function is not `showToast`, update the call in `saveAsTemplate` to match the actual function name.

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add save-as-template button to game cards"
```

---

### Task 5: SuperAdmin manage-templates view

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

- [ ] **Step 1: Add manage-templates state**

Find `const [saveTemplateLoading, setSaveTemplateLoading] = useState(false);` (added in Task 4). Add after it:

```typescript
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editTemplateIcon, setEditTemplateIcon] = useState('');
  const [editTemplateMissions, setEditTemplateMissions] = useState<string[]>([]);
  const [editTemplateLoading, setEditTemplateLoading] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateIcon, setNewTemplateIcon] = useState('🎮');
  const [newTemplateMissions, setNewTemplateMissions] = useState<string[]>([]);
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [manageTemplatesLoading, setManageTemplatesLoading] = useState(false);
```

- [ ] **Step 2: Add updateBuiltinTemplate and deleteBuiltinTemplate functions**

Add these functions alongside the other template functions:

```typescript
  async function updateBuiltinTemplate(id: string, name: string, icon: string, missionIds: string[]) {
    setEditTemplateLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(`/api/admin/templates/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ name, icon, missionIds }),
      });
      if (!res.ok) throw new Error('Failed to update template');
      const { template } = await res.json();
      setTemplates(prev => prev.map(t => t.id === id ? template : t));
      setEditingTemplateId(null);
    } catch (err) {
      console.error('Failed to update template:', err);
    } finally {
      setEditTemplateLoading(false);
    }
  }

  async function deleteBuiltinTemplate(id: string) {
    const session = (await supabase.auth.getSession()).data.session;
    await fetch(`/api/admin/templates/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setTemplates(prev => prev.filter(t => t.id !== id));
  }

  async function createBuiltinTemplate(name: string, icon: string, missionIds: string[]) {
    setManageTemplatesLoading(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/admin/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ name, icon, missionIds, isBuiltin: true }),
      });
      if (!res.ok) throw new Error('Failed to create template');
      const { template } = await res.json();
      setTemplates(prev => [template, ...prev.filter(t => !t.isBuiltin), ...prev.filter(t => t.isBuiltin)]);
      setShowNewTemplateForm(false);
      setNewTemplateName('');
      setNewTemplateIcon('🎮');
      setNewTemplateMissions([]);
    } catch (err) {
      console.error('Failed to create template:', err);
    } finally {
      setManageTemplatesLoading(false);
    }
  }
```

- [ ] **Step 3: Add the manage-templates view JSX**

Find (right before `if (view === 'templates') return (` which was added in Task 3). Insert this new block immediately **before** it:

```tsx
  if (view === 'manage-templates') return (
    <>
      <nav className="nav" style={{ position: 'relative' }}>
        <div className="nav-brand"><GameOnLogo size={22} /></div>
        <div className="nav-right">
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => { loadTemplates(); setView('games'); }}>← BACK</button>
        </div>
      </nav>
      <div className="container fade-in" style={{ maxWidth: '680px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 0 24px' }}>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>Manage Templates</h2>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: '14px' }}>Edit built-in templates visible to all admins</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowNewTemplateForm(true)} style={{ fontSize: '13px' }}>+ NEW TEMPLATE</button>
        </div>

        {/* New template form */}
        {showNewTemplateForm && (
          <div style={{ background: 'var(--card)', border: '1px solid var(--accent)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '14px', color: 'var(--text)' }}>New built-in template</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                value={newTemplateIcon}
                onChange={e => setNewTemplateIcon(e.target.value)}
                style={{ width: '44px', padding: '7px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '20px', textAlign: 'center', fontFamily: "'Sora', sans-serif" }}
              />
              <input
                value={newTemplateName}
                onChange={e => setNewTemplateName(e.target.value)}
                placeholder="Template name"
                style={{ flex: 1, padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', fontFamily: "'Sora', sans-serif" }}
              />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
              Select missions ({newTemplateMissions.length} selected) — use the same mission IDs as in create-game:
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
              {MISSIONS.map(m => {
                const on = newTemplateMissions.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => setNewTemplateMissions(prev => on ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'rgba(124,189,212,0.12)' : 'transparent', color: on ? 'var(--accent)' : 'var(--muted)', fontSize: '11px', cursor: 'pointer', fontFamily: "'Sora', sans-serif' " }}
                  >
                    {m.icon} {m.name}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => createBuiltinTemplate(newTemplateName, newTemplateIcon, newTemplateMissions)}
                disabled={manageTemplatesLoading || !newTemplateName.trim() || newTemplateMissions.length === 0}
                style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#0a0e19', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
              >
                {manageTemplatesLoading ? 'Saving...' : 'CREATE'}
              </button>
              <button
                onClick={() => { setShowNewTemplateForm(false); setNewTemplateName(''); setNewTemplateIcon('🎮'); setNewTemplateMissions([]); }}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Built-in template list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {templates.filter(t => t.isBuiltin).map(t => (
            <div key={t.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 20px', background: 'var(--card)', border: `1px solid ${editingTemplateId === t.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: editingTemplateId === t.id ? '12px 12px 0 0' : '12px' }}>
                <span style={{ fontSize: '24px' }}>{t.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{t.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{t.missionIds.length} missions</div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => { setEditingTemplateId(t.id); setEditTemplateName(t.name); setEditTemplateIcon(t.icon); setEditTemplateMissions([...t.missionIds]); }}
                    style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '12px', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 600 }}
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${t.name}"?`)) deleteBuiltinTemplate(t.id); }}
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: '#ef4444', fontSize: '14px', cursor: 'pointer' }}
                  >
                    🗑
                  </button>
                </div>
              </div>

              {/* Inline edit form */}
              {editingTemplateId === t.id && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--accent)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input
                      value={editTemplateIcon}
                      onChange={e => setEditTemplateIcon(e.target.value)}
                      style={{ width: '44px', padding: '7px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '20px', textAlign: 'center', fontFamily: "'Sora', sans-serif" }}
                    />
                    <input
                      value={editTemplateName}
                      onChange={e => setEditTemplateName(e.target.value)}
                      style={{ flex: 1, padding: '7px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '13px', fontFamily: "'Sora', sans-serif" }}
                    />
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>Missions ({editTemplateMissions.length} selected)</div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                    {MISSIONS.map(m => {
                      const on = editTemplateMissions.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => setEditTemplateMissions(prev => on ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                          style={{ padding: '4px 8px', borderRadius: '6px', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'rgba(124,189,212,0.12)' : 'transparent', color: on ? 'var(--accent)' : 'var(--muted)', fontSize: '11px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                        >
                          {m.icon} {m.name}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => updateBuiltinTemplate(t.id, editTemplateName, editTemplateIcon, editTemplateMissions)}
                      disabled={editTemplateLoading || !editTemplateName.trim() || editTemplateMissions.length === 0}
                      style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#0a0e19', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                    >
                      {editTemplateLoading ? 'Saving...' : 'SAVE'}
                    </button>
                    <button
                      onClick={() => setEditingTemplateId(null)}
                      style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
```

- [ ] **Step 4: Add "Manage Templates" button to the games list header**

Find in the games list header (around line 862):
```tsx
            <button className="btn btn-primary" onClick={() => { loadTemplates(); setView('templates'); }}>+ NEW GAME</button>
```

Add the "Manage Templates" button immediately before it:
```tsx
            {isSuperAdmin && (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { loadTemplates(); setView('manage-templates'); }}>⚙️ Templates</button>
            )}
            <button className="btn btn-primary" onClick={() => { loadTemplates(); setView('templates'); }}>+ NEW GAME</button>
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: no errors.

- [ ] **Step 6: Build check**

```bash
cd /Users/signevallin/Desktop/GameOn && npm run build 2>&1 | tail -8
```

Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add superadmin manage-templates view"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `game_templates` table with RLS | Task 1 |
| Seed 3 built-in templates (14/12/13 missions) | Task 1 |
| `GameTemplate` TypeScript type | Task 2 |
| `toGameTemplate` mapper | Task 2 |
| GET /api/admin/templates | Task 2 |
| POST /api/admin/templates (builtin guard) | Task 2 |
| PUT /api/admin/templates/[id] (ownership check) | Task 2 |
| DELETE /api/admin/templates/[id] (ownership check) | Task 2 |
| Template library view (`view = 'templates'`) | Task 3 |
| Built-in templates section | Task 3 |
| My templates section (with delete) | Task 3 |
| Blank game option | Task 3 |
| Empty state for no saved templates | Task 3 |
| "+ NEW GAME" → templates view | Task 3 |
| Mission pre-fill via `setSelectedMissions` | Task 3 |
| "Save as template" button on game cards | Task 4 |
| Inline save form (icon + name) | Task 4 |
| `manage-templates` view (superadmin) | Task 5 |
| Create new built-in template | Task 5 |
| Edit built-in template inline | Task 5 |
| Delete built-in template with confirm | Task 5 |
| "⚙️ Templates" button in games list (superadmin only) | Task 5 |
| All text in English | All tasks |

**Placeholder scan:** None found.

**Type consistency:** `GameTemplate.missionIds` (camelCase) used consistently across all tasks. `toGameTemplate` always converts `mission_ids` → `missionIds`. `MISSIONS` is the existing constant from `lib/missions.ts` — already in scope in AdminScreen. `showToast` call in Task 4 Step 2 includes a note to verify the actual function name.
