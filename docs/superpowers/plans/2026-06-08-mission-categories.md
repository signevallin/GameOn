# Mission Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins create multiple named categories (each with a custom emoji) and assign their custom missions to them, replacing the single hardcoded ⭐ label in the game creation view.

**Architecture:** New `custom_mission_categories` table holds per-admin categories (id, name, emoji, sort_order). `custom_missions` gets a nullable `category_id` FK. A new API route handles CRUD for categories. AdminScreen gains a category manager UI, a category dropdown in the mission form, and refactored game creation grouping.

**Tech Stack:** Next.js App Router, Supabase (PostgreSQL + service-role client), TypeScript, inline styles.

---

## File Structure

| File | Change |
|------|--------|
| `docs/sql/2026-06-08-mission-categories.sql` | **Create** — DB migration: new table + ALTER custom_missions |
| `app/api/admin/mission-categories/route.ts` | **Create** — GET / POST / DELETE for categories |
| `app/api/admin/custom-missions/route.ts` | **Modify** — add `category_id` to POST + PUT |
| `lib/supabase.ts` | **Modify** — add `category_id: string \| null` to `CustomMission` type |
| `components/screens/AdminScreen.tsx` | **Modify** — state, load, category manager UI, form dropdown, game creation grouping |

---

### Task 1: DB migration

**Files:**
- Create: `docs/sql/2026-06-08-mission-categories.sql`

- [ ] **Step 1: Create the SQL file**

```sql
-- docs/sql/2026-06-08-mission-categories.sql
-- 1. New table for categories
CREATE TABLE custom_mission_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '📋',
  sort_order  INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE custom_mission_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_mission_categories_owner"
  ON custom_mission_categories
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Add category_id FK to custom_missions (nullable — existing rows default to NULL)
ALTER TABLE custom_missions
  ADD COLUMN category_id UUID REFERENCES custom_mission_categories(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Apply in Supabase**

Open the Supabase dashboard → SQL Editor, paste the SQL above, and run it.

Expected: no errors. Verify by checking Table Editor for the new `custom_mission_categories` table and the new `category_id` column on `custom_missions`.

- [ ] **Step 3: Commit**

```bash
git add docs/sql/2026-06-08-mission-categories.sql
git commit -m "feat: add mission categories DB migration"
```

---

### Task 2: Categories API route

**Files:**
- Create: `app/api/admin/mission-categories/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/admin/mission-categories/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — list all categories for this admin, ordered by sort_order
export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('custom_mission_categories')
    .select('id, name, emoji, sort_order')
    .eq('user_id', admin.userId)
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data ?? [] });
}

// POST — create a new category { name, emoji }
export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  let body: { name?: unknown; emoji?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { name, emoji } = body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name required' }, { status: 400 });
  }

  const supabase = getSupabase();

  // Compute next sort_order
  const { data: maxRow } = await supabase
    .from('custom_mission_categories')
    .select('sort_order')
    .eq('user_id', admin.userId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();
  const nextOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('custom_mission_categories')
    .insert({
      user_id: admin.userId,
      name: name.trim(),
      emoji: (typeof emoji === 'string' && emoji.trim()) ? emoji.trim() : '📋',
      sort_order: nextOrder,
    })
    .select('id, name, emoji, sort_order')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}

// DELETE — delete category by ?id= (missions get category_id = NULL via ON DELETE SET NULL)
export async function DELETE(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = getSupabase();
  const { error } = await supabase
    .from('custom_mission_categories')
    .delete()
    .eq('id', id)
    .eq('user_id', admin.userId); // safety: can only delete own categories

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/mission-categories/route.ts
git commit -m "feat: add mission categories API route (GET/POST/DELETE)"
```

---

### Task 3: Update custom-missions route — add category_id

**Files:**
- Modify: `app/api/admin/custom-missions/route.ts`

Read the file first. Find the `POST` handler body destructuring and the `PUT` handler body destructuring. Add `category_id` to both.

- [ ] **Step 1: Add `category_id` to POST**

Find the POST body destructuring. It currently looks like:
```typescript
const { category_name, name, icon, desc, difficulty, max_pts, type, data, sort_order } = await req.json() as { ... };
```

Add `category_id` to it:
```typescript
const { category_name, name, icon, desc, difficulty, max_pts, type, data, sort_order, category_id } = await req.json() as {
  category_name?: string;
  name: string;
  icon?: string;
  desc?: string;
  difficulty?: string;
  max_pts?: number;
  type: string;
  data?: Record<string, unknown>;
  sort_order?: number;
  category_id?: string | null;
};
```

In the insert object, add:
```typescript
category_id: category_id ?? null,
```

- [ ] **Step 2: Add `category_id` to PUT**

Find the PUT handler (same pattern). Add `category_id` to the body destructuring:
```typescript
const { name, icon, desc, difficulty, max_pts, type, data, sort_order, category_id } = await req.json() as {
  name?: string;
  icon?: string;
  desc?: string;
  difficulty?: string;
  max_pts?: number;
  type?: string;
  data?: Record<string, unknown>;
  sort_order?: number;
  category_id?: string | null;
};
```

In the update object, add:
```typescript
...(category_id !== undefined ? { category_id: category_id ?? null } : {}),
```

The GET already uses `select('*')` so `category_id` is returned automatically — no change needed there.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/custom-missions/route.ts
git commit -m "feat: add category_id to custom-missions API"
```

---

### Task 4: Update CustomMission type

**Files:**
- Modify: `lib/supabase.ts`

- [ ] **Step 1: Add `category_id` to `CustomMission`**

Open `lib/supabase.ts`. Find the `CustomMission` type:

```typescript
export type CustomMission = {
  id: string;
  user_id: string;
  category_name: string;
  name: string;
  icon: string;
  desc: string;
  difficulty: 'easy' | 'medium' | 'hard';
  max_pts: number;
  type: string;
  data: Record<string, unknown>;
  sort_order: number;
  created_at: string;
};
```

Add `category_id` after `category_name`:

```typescript
export type CustomMission = {
  id: string;
  user_id: string;
  category_name: string;
  category_id: string | null;
  name: string;
  icon: string;
  desc: string;
  difficulty: 'easy' | 'medium' | 'hard';
  max_pts: number;
  type: string;
  data: Record<string, unknown>;
  sort_order: number;
  created_at: string;
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: add category_id to CustomMission type"
```

---

### Task 5: AdminScreen — category state, load, and management UI

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

This task adds the `AdminCategory` type, state variables, updates `loadAdminCustomMissions` to also fetch categories, and adds the category management section (list + create form) in the My Missions view.

- [ ] **Step 1: Add `AdminCategory` type**

Near the top of AdminScreen.tsx, find where other local types are defined (search for `type MissionFormData`). Add above or below it:

```typescript
type AdminCategory = { id: string; name: string; emoji: string; sort_order: number };
```

- [ ] **Step 2: Add category state variables**

Find the block with AI state variables (which ends with `const [aiError, setAiError] = useState('');`). Add immediately after:

```typescript
  const [adminCategories, setAdminCategories] = useState<AdminCategory[]>([]);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormEmoji, setCategoryFormEmoji] = useState('📋');
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState('');
```

- [ ] **Step 3: Update `loadAdminCustomMissions` to also load categories**

Find `loadAdminCustomMissions`. Replace it entirely with:

```typescript
  async function loadAdminCustomMissions() {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    };
    const [missionsRes, catsRes] = await Promise.all([
      fetch('/api/admin/custom-missions', { method: 'GET', headers, cache: 'no-store' }),
      fetch('/api/admin/mission-categories', { method: 'GET', headers }),
    ]);
    const missionsData = await missionsRes.json();
    const catsData = await catsRes.json();
    if (missionsData.missions) {
      setAdminCustomMissions(missionsData.missions);
      if (missionsData.missions.length > 0) setCustomCategoryName(missionsData.missions[0].category_name);
    }
    if (catsData.categories) setAdminCategories(catsData.categories);
  }
```

- [ ] **Step 4: Add category management section in My Missions view**

In the My Missions render block (inside `if (view === 'missions')`), find the section that shows the "CATEGORY NAME (shown to teams)" input. It looks like:

```typescript
<label style={labelStyle}>CATEGORY NAME (shown to teams)</label>
<div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
  <input
    type="text"
    value={customCategoryName}
    ...
  />
  <button ... onClick={saveCategoryName}>
    {categoryNameSaving ? '...' : 'Save'}
  </button>
</div>
```

Replace that entire block (from the label to the closing `</div>`) with the new categories manager:

```typescript
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <label style={labelStyle}>CATEGORIES</label>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: '11px', padding: '4px 10px' }}
                        onClick={() => { setCategoryFormOpen(v => !v); setCategoryError(''); setCategoryFormName(''); setCategoryFormEmoji('📋'); }}
                      >
                        {categoryFormOpen ? '✕ Cancel' : '+ New category'}
                      </button>
                    </div>

                    {/* Existing categories list */}
                    {adminCategories.length === 0 && !categoryFormOpen && (
                      <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 8px' }}>No categories yet. Create one to organise your missions.</p>
                    )}
                    {adminCategories.map(cat => (
                      <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '18px', width: '28px', textAlign: 'center' }}>{cat.emoji}</span>
                        <span style={{ flex: 1, fontSize: '14px' }}>{cat.name}</span>
                        <button
                          onClick={async () => {
                            const res = await fetch(`/api/admin/mission-categories?id=${cat.id}`, {
                              method: 'DELETE',
                              headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
                            });
                            if (res.ok) {
                              setAdminCategories(prev => prev.filter(c => c.id !== cat.id));
                              // Missions with this category_id now show under Övrigt
                              setAdminCustomMissions(prev => prev.map(m => m.category_id === cat.id ? { ...m, category_id: null } : m));
                            }
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', padding: '0 4px' }}
                          title="Delete category"
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    {/* New category inline form */}
                    {categoryFormOpen && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '10px' }}>
                        <input
                          type="text"
                          value={categoryFormEmoji}
                          onChange={e => setCategoryFormEmoji(e.target.value.slice(-2) || '📋')}
                          style={{ ...inputStyle, width: '48px', textAlign: 'center', fontSize: '18px', padding: '8px 4px', flexShrink: 0 }}
                          maxLength={2}
                          placeholder="📋"
                        />
                        <input
                          type="text"
                          value={categoryFormName}
                          onChange={e => setCategoryFormName(e.target.value)}
                          placeholder="Category name…"
                          style={{ ...inputStyle, flex: 1 }}
                          onKeyDown={async e => { if (e.key === 'Enter' && categoryFormName.trim()) await saveCategory(); }}
                        />
                        <button
                          className="btn btn-primary"
                          style={{ padding: '8px 14px', fontSize: '12px', flexShrink: 0 }}
                          disabled={!categoryFormName.trim() || categorySaving}
                          onClick={saveCategory}
                        >
                          {categorySaving ? '…' : 'Save'}
                        </button>
                      </div>
                    )}
                    {categoryError && <p style={{ fontSize: '12px', color: 'var(--danger, #e74c3c)', marginTop: '6px' }}>{categoryError}</p>}
                  </div>
```

- [ ] **Step 5: Add `saveCategory` function**

Inside the `if (view === 'missions')` block, near the other helper functions (`openEditForm`, `generateWithAI`), add:

```typescript
    async function saveCategory() {
      if (!categoryFormName.trim()) return;
      setCategorySaving(true);
      setCategoryError('');
      try {
        const res = await fetch('/api/admin/mission-categories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({ name: categoryFormName.trim(), emoji: categoryFormEmoji || '📋' }),
        });
        if (!res.ok) { setCategoryError('Failed to save category.'); return; }
        const data = await res.json() as { category: AdminCategory };
        setAdminCategories(prev => [...prev, data.category]);
        setCategoryFormOpen(false);
        setCategoryFormName('');
        setCategoryFormEmoji('📋');
      } catch {
        setCategoryError('Failed to save category.');
      } finally {
        setCategorySaving(false);
      }
    }
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. If `inputStyle` or `labelStyle` is not in scope in the categories block, search for where they are defined and make sure the new JSX is inside that scope.

- [ ] **Step 7: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add category management UI to My Missions view"
```

---

### Task 6: AdminScreen — category dropdown in mission form + save integration

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

- [ ] **Step 1: Add `missionCategoryId` state**

Near the `missionFormError` state (around line 455), add:

```typescript
  const [missionCategoryId, setMissionCategoryId] = useState<string | null>(null);
```

- [ ] **Step 2: Add category dropdown to mission form**

Find the DESCRIPTION field in the mission form:
```typescript
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>DESCRIPTION</label>
                <input type="text" value={missionForm.desc} ...
```

Add the category dropdown AFTER the description block (before the difficulty/maxPts/type grid):

```typescript
              {adminCategories.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>CATEGORY</label>
                  <select
                    value={missionCategoryId ?? ''}
                    onChange={e => setMissionCategoryId(e.target.value || null)}
                    style={inputStyle}
                  >
                    <option value="">(No category)</option>
                    {adminCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                    ))}
                  </select>
                </div>
              )}
```

- [ ] **Step 3: Set `missionCategoryId` when opening edit form**

In `openEditForm(cm)`, add at the end (before `setShowMissionForm(true)`):

```typescript
    setMissionCategoryId(cm.category_id ?? null);
```

- [ ] **Step 4: Reset `missionCategoryId` when opening new form**

Find the `openNewForm` function (or wherever `setMissionForm(EMPTY_FORM)` is called for a new mission). Add:

```typescript
    setMissionCategoryId(null);
```

- [ ] **Step 5: Include `category_id` in mission save (POST and PUT)**

Find the `saveMission` function. It builds a body object and calls either POST or PUT. Add `category_id: missionCategoryId` to the body:

Look for something like:
```typescript
      body: JSON.stringify({
        name: missionForm.name,
        icon: missionForm.icon,
        ...
```

Add to that object:
```typescript
        category_id: missionCategoryId,
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add category dropdown to mission form"
```

---

### Task 7: AdminScreen — game creation view grouped by category

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

Replace the current single-group custom missions block with multi-group rendering.

- [ ] **Step 1: Replace the custom missions block in game creation view**

Find this block (in the game creation missions selection area):

```typescript
            {/* ── Custom missions ── */}
            {adminCustomMissions.length > 0 && (() => {
              const catName = adminCustomMissions[0].category_name;
              const allOn = adminCustomMissions.every(m => selectedMissions.includes(m.id));
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', color: '#9b59b6' }}>
                      ⭐ {catName.toUpperCase()}
                    </span>
                    <button
                      onClick={() => {
                        const ids = adminCustomMissions.map(m => m.id);
                        setSelectedMissions(prev => allOn
                          ? prev.filter(x => !ids.includes(x))
                          : [...new Set([...prev, ...ids])]);
                      }}
                      style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                    >
                      {allOn ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {adminCustomMissions.map(m => {
                      const on = selectedMissions.includes(m.id);
                      const pts = missionMaxPts[m.id] ?? m.max_pts;
                      return (
                        <div key={m.id} style={{ background: 'var(--card)', border: `1px solid ${on ? '#9b59b6' : 'var(--border)'}`, borderRadius: '8px', opacity: on ? 1 : 0.45 }}>
                          <div
                            onClick={() => {
                              setSelectedMissions(prev => on ? prev.filter(x => x !== m.id) : [...prev, m.id]);
                              if (!missionMaxPts[m.id]) setMissionMaxPts(prev => ({ ...prev, [m.id]: m.max_pts }));
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px', cursor: 'pointer' }}
                          >
                            <span style={{ fontSize: '18px' }}>{m.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: '13px' }}>{m.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.difficulty} · {m.max_pts} pts</div>
                            </div>
                            <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: on ? '#9b59b6' : 'var(--border)', position: 'relative', flexShrink: 0 }}>
                              <div style={{ position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
```

Replace the entire block with:

```typescript
            {/* ── Custom missions — grouped by category ── */}
            {adminCustomMissions.length > 0 && (() => {
              // Build category lookup
              const catMap = new Map(adminCategories.map(c => [c.id, c]));

              // Group missions by category_id
              const buckets = new Map<string | null, typeof adminCustomMissions>();
              for (const m of adminCustomMissions) {
                const key = m.category_id ?? null;
                if (!buckets.has(key)) buckets.set(key, []);
                buckets.get(key)!.push(m);
              }

              // Build ordered groups: named categories first (in sort_order), then null (Övrigt)
              const groups: { cat: AdminCategory | null; missions: typeof adminCustomMissions }[] = [];
              for (const cat of adminCategories) {
                if (buckets.has(cat.id)) groups.push({ cat, missions: buckets.get(cat.id)! });
              }
              if (buckets.has(null)) groups.push({ cat: null, missions: buckets.get(null)! });

              return (
                <>
                  {groups.map(({ cat, missions }) => {
                    const label = cat ? `${cat.emoji} ${cat.name.toUpperCase()}` : '📋 ÖVRIGT';
                    const groupIds = missions.map(m => m.id);
                    const allOn = groupIds.every(id => selectedMissions.includes(id));
                    return (
                      <div key={cat?.id ?? '__uncategorized'} style={{ marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', color: '#9b59b6' }}>
                            {label}
                          </span>
                          <button
                            onClick={() => {
                              setSelectedMissions(prev => allOn
                                ? prev.filter(x => !groupIds.includes(x))
                                : [...new Set([...prev, ...groupIds])]);
                            }}
                            style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                          >
                            {allOn ? 'Deselect all' : 'Select all'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {missions.map(m => {
                            const on = selectedMissions.includes(m.id);
                            return (
                              <div key={m.id} style={{ background: 'var(--card)', border: `1px solid ${on ? '#9b59b6' : 'var(--border)'}`, borderRadius: '8px', opacity: on ? 1 : 0.45 }}>
                                <div
                                  onClick={() => {
                                    setSelectedMissions(prev => on ? prev.filter(x => x !== m.id) : [...prev, m.id]);
                                    if (!missionMaxPts[m.id]) setMissionMaxPts(prev => ({ ...prev, [m.id]: m.max_pts }));
                                  }}
                                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px', cursor: 'pointer' }}
                                >
                                  <span style={{ fontSize: '18px' }}>{m.icon}</span>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{m.name}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.difficulty} · {m.max_pts} pts</div>
                                  </div>
                                  <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: on ? '#9b59b6' : 'var(--border)', position: 'relative', flexShrink: 0 }}>
                                    <div style={{ position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. The `AdminCategory` type used in the grouping (`cat: AdminCategory | null`) must be in scope — it was defined in Task 5 Step 1 at the top of the component file.

- [ ] **Step 3: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: group custom missions by category in game creation view"
```
