# Mission Content Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three mission-content improvements: (1) a "Hide already played" toggle in the game creation mission picker, (2) an `excludedNames` param for the AI mission generator wired to the admin's last game, and (3) seasonal `active_from` / `active_until` windows on custom missions that hide them from teams when out of range.

**Architecture:**
- Feature 1 reads the admin's own past `games.missions` arrays via a new lightweight `GET /api/admin/played-missions` endpoint and filters the existing mission picker client-side. No DB changes.
- Feature 2 widens the AI generator route's contract with an optional `excludedNames: string[]` (validated, max 50, each ≤100 chars) appended to the user prompt; AdminScreen computes `lastGameMissionNames` from already-loaded games and missions.
- Feature 3 adds two nullable `TIMESTAMPTZ` columns to `custom_missions`, threads them through GET/POST/PUT custom-missions admin routes, filters them out of `/api/team/login` when the current time falls outside the window, and adds two date inputs to the mission form.

**Tech Stack:** Next.js App Router (route handlers), Supabase (service-role server-side, no RLS reliance for admin paths), TypeScript, inline styles. No test framework — verification uses `curl` against `npm run dev` and direct Supabase MCP queries.

---

## File Structure

| File | Change |
|------|--------|
| `app/api/admin/played-missions/route.ts` | **Create** — GET endpoint returning deduplicated mission IDs from this admin's past games |
| `app/api/admin/ai-generate-mission/route.ts` | **Modify** — accept + validate `excludedNames`, append to user message |
| `app/api/admin/custom-missions/route.ts` | **Modify** — include `active_from`/`active_until` in SELECT and POST insert |
| `app/api/admin/custom-missions/[id]/route.ts` | **Modify** — accept `active_from`/`active_until` in PUT body |
| `app/api/team/login/route.ts` | **Modify** — filter custom missions to those whose active window includes `now` |
| `components/screens/AdminScreen.tsx` | **Modify** — played-missions fetch + state + toggle; pass `excludedNames` to AI route; extend `MissionFormData` + `EMPTY_FORM` + form UI + save logic with active-window fields |
| Supabase migration `add_seasonal_windows_to_custom_missions` | **Create** — add two nullable `TIMESTAMPTZ` columns to `custom_missions` |

---

## Task 1: DB migration — seasonal window columns

**Files:** Supabase project (migration via MCP).

- [ ] **Step 1: Apply the migration** using the Supabase MCP `apply_migration` tool with name `add_seasonal_windows_to_custom_missions` and the following SQL:

```sql
ALTER TABLE public.custom_missions
  ADD COLUMN IF NOT EXISTS active_from  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS active_until TIMESTAMPTZ DEFAULT NULL;

-- Helps the team-login query that filters on the active window.
CREATE INDEX IF NOT EXISTS custom_missions_active_window_idx
  ON public.custom_missions (user_id, active_from, active_until);
```

- [ ] **Step 2: Verify** via Supabase MCP `execute_sql`:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'custom_missions'
  AND column_name IN ('active_from', 'active_until');
```

Both rows must appear with `data_type = 'timestamp with time zone'`, `is_nullable = 'YES'`, `column_default = NULL`.

- [ ] **Step 3: Regenerate TS types** (skip if the repo does not check in generated types — confirm by `git ls-files | grep -i "supabase.*types"`. If a file like `lib/database.types.ts` exists, regenerate via MCP `generate_typescript_types` and overwrite). Run `npx tsc --noEmit 2>&1 | head -10` after.

- [ ] **Step 4: Commit**:

```bash
git add -A
git commit -m "db: add active_from/active_until to custom_missions"
```

---

## Task 2: `/api/admin/played-missions` route

**Files:**
- Create: `app/api/admin/played-missions/route.ts`

- [ ] **Step 1: Create the route file** with this exact content:

```typescript
// app/api/admin/played-missions/route.ts
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

export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { data, error } = await getSupabase()
    .from('games')
    .select('missions')
    .eq('user_id', admin.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const set = new Set<string>();
  for (const row of data ?? []) {
    const missions = (row as { missions: unknown }).missions;
    if (Array.isArray(missions)) {
      for (const id of missions) {
        if (typeof id === 'string' && id.length > 0) set.add(id);
      }
    }
  }

  return NextResponse.json({ playedIds: Array.from(set) });
}
```

- [ ] **Step 2: Typecheck**:

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: no new errors referencing this file.

- [ ] **Step 3: Manual verify** with the dev server running (`npm run dev` in another terminal). Get a valid admin bearer token from the browser (DevTools → Application → Local Storage → `adminToken`) and:

```bash
TOKEN="..."  # paste from browser
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/admin/played-missions | head -c 500
```

Expected JSON shape: `{"playedIds":["typerace","freeze_tag",...]}` — or `{"playedIds":[]}` for a brand-new account. A 401 means the token is stale; refresh from the browser.

- [ ] **Step 4: Commit**:

```bash
git add app/api/admin/played-missions/route.ts
git commit -m "feat: add /api/admin/played-missions endpoint"
```

---

## Task 3: AI generator — `excludedNames` support

**Files:**
- Modify: `app/api/admin/ai-generate-mission/route.ts`

- [ ] **Step 1: Widen the request body type** — find the line:

```typescript
  let body: { prompt?: unknown; type?: unknown; language?: unknown };
```

and replace with:

```typescript
  let body: { prompt?: unknown; type?: unknown; language?: unknown; excludedNames?: unknown };
```

- [ ] **Step 2: Destructure and validate `excludedNames`** — find:

```typescript
  const { prompt, type, language } = body;
```

and replace with:

```typescript
  const { prompt, type, language, excludedNames } = body;

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
```

- [ ] **Step 3: Append exclusions to the user message** — find:

```typescript
  const userMessage = `${typeInstruction}
Language: ${language}
Topic/description: ${prompt}`;
```

and replace with:

```typescript
  const exclusionLine = safeExcluded.length > 0
    ? `\n\nDo NOT create a mission about any of these topics (already used): ${safeExcluded.join(', ')}`
    : '';
  const userMessage = `${typeInstruction}
Language: ${language}
Topic/description: ${prompt}${exclusionLine}`;
```

- [ ] **Step 4: Typecheck**:

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 5: Manual verify** — with `npm run dev` running and a Pro account token:

```bash
TOKEN="..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"prompt":"Animal facts","language":"en","excludedNames":["Cats","Dogs","Elephants"]}' \
  http://localhost:3000/api/admin/ai-generate-mission | head -c 600
```

Expected: a JSON mission object whose `name`/`desc` does not center on cats/dogs/elephants. Run twice — names should drift to other animals.

Then verify validation rejects non-array:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"prompt":"x","language":"en","excludedNames":"cats"}' \
  http://localhost:3000/api/admin/ai-generate-mission
```

Expected: `{"error":"invalid_excluded_names"}` with HTTP 400.

- [ ] **Step 6: Commit**:

```bash
git add app/api/admin/ai-generate-mission/route.ts
git commit -m "feat: support excludedNames in AI mission generator"
```

---

## Task 4: Custom-missions API — pass through active window

**Files:**
- Modify: `app/api/admin/custom-missions/route.ts`
- Modify: `app/api/admin/custom-missions/[id]/route.ts`

- [ ] **Step 1: GET already returns `*`** — no change needed for SELECT; new columns will surface automatically once Task 1 lands.

- [ ] **Step 2: Add a shared validator** at the top of `app/api/admin/custom-missions/route.ts` (just under `function getSupabase()`):

```typescript
// Accepts an ISO 8601 string, null, or undefined. Returns
// { ok: true, value } where value is a normalized ISO string or null,
// or { ok: false } when the input is not parseable.
function parseActiveWindow(input: unknown): { ok: true; value: string | null } | { ok: false } {
  if (input === undefined || input === null || input === '') return { ok: true, value: null };
  if (typeof input !== 'string') return { ok: false };
  const t = Date.parse(input);
  if (Number.isNaN(t)) return { ok: false };
  return { ok: true, value: new Date(t).toISOString() };
}
```

- [ ] **Step 3: Wire validator into POST** — find this block in the same file:

```typescript
  const body = await req.json();
  const { category_name, category_id, name, icon, desc, difficulty, max_pts, type, data, sort_order } = body;
```

and replace with:

```typescript
  const body = await req.json();
  const { category_name, category_id, name, icon, desc, difficulty, max_pts, type, data, sort_order, active_from, active_until } = body;

  const activeFrom = parseActiveWindow(active_from);
  if (!activeFrom.ok) return NextResponse.json({ error: 'Invalid active_from.' }, { status: 400 });
  const activeUntil = parseActiveWindow(active_until);
  if (!activeUntil.ok) return NextResponse.json({ error: 'Invalid active_until.' }, { status: 400 });
```

- [ ] **Step 4: Persist the values on insert** — extend the `.insert({...})` object so the trailing fields are:

```typescript
      data: data ?? {},
      sort_order: sort_order ?? 0,
      active_from: activeFrom.value,
      active_until: activeUntil.value,
```

- [ ] **Step 5: Export `parseActiveWindow` for reuse in PUT** — at the bottom of `app/api/admin/custom-missions/route.ts` add:

```typescript
export { parseActiveWindow };
```

- [ ] **Step 6: Update PUT handler** in `app/api/admin/custom-missions/[id]/route.ts`. Add import at the top, just under the existing imports:

```typescript
import { parseActiveWindow } from '../route';
```

Then find:

```typescript
  const { category_id, name, icon, desc, difficulty, max_pts, type, data, sort_order } = body;
```

and replace with:

```typescript
  const { category_id, name, icon, desc, difficulty, max_pts, type, data, sort_order, active_from, active_until } = body;
```

Then, just before the `// Only include fields that were explicitly provided` comment, add:

```typescript
  let activeFromParsed: { value: string | null } | null = null;
  if (active_from !== undefined) {
    const r = parseActiveWindow(active_from);
    if (!r.ok) return NextResponse.json({ error: 'Invalid active_from.' }, { status: 400 });
    activeFromParsed = { value: r.value };
  }
  let activeUntilParsed: { value: string | null } | null = null;
  if (active_until !== undefined) {
    const r = parseActiveWindow(active_until);
    if (!r.ok) return NextResponse.json({ error: 'Invalid active_until.' }, { status: 400 });
    activeUntilParsed = { value: r.value };
  }
```

Then, at the end of the `updateFields` assignments (right after `if (category_id !== undefined) updateFields.category_id = category_id ?? null;`), add:

```typescript
  if (activeFromParsed) updateFields.active_from = activeFromParsed.value;
  if (activeUntilParsed) updateFields.active_until = activeUntilParsed.value;
```

- [ ] **Step 7: Typecheck**:

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 8: Manual verify** — create a mission with a window, then read it back:

```bash
TOKEN="..."
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Halloween Trivia","type":"trivia_quiz","active_from":"2026-10-01T00:00:00Z","active_until":"2026-11-01T00:00:00Z"}' \
  http://localhost:3000/api/admin/custom-missions
```

Expected `mission.active_from` and `mission.active_until` set to ISO strings. Then reject a bad value:

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"x","type":"photo","active_from":"not-a-date"}' \
  http://localhost:3000/api/admin/custom-missions
```

Expected `{"error":"Invalid active_from."}` with HTTP 400.

- [ ] **Step 9: Commit**:

```bash
git add app/api/admin/custom-missions/route.ts app/api/admin/custom-missions/[id]/route.ts
git commit -m "feat: accept active_from/active_until on custom-missions admin routes"
```

---

## Task 5: Team login — filter to active custom missions

**Files:**
- Modify: `app/api/team/login/route.ts`

- [ ] **Step 1: Add the active-window filter to the custom-missions query.** Find:

```typescript
    game.user_id
      ? supabase.from('custom_missions').select('*').eq('user_id', game.user_id).order('sort_order').order('created_at')
      : Promise.resolve({ data: [] }),
```

and replace with:

```typescript
    game.user_id
      ? (() => {
          const nowIso = new Date().toISOString();
          return supabase
            .from('custom_missions')
            .select('*')
            .eq('user_id', game.user_id)
            .or(`active_from.is.null,active_from.lte.${nowIso}`)
            .or(`active_until.is.null,active_until.gte.${nowIso}`)
            .order('sort_order')
            .order('created_at');
        })()
      : Promise.resolve({ data: [] }),
```

> **Why the IIFE:** PostgREST's `.or()` accepts a string with a fixed format — we need `nowIso` interpolated, and we want to compute it once per request so both `.or()` chains agree.

- [ ] **Step 2: Typecheck**:

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Manual verify** with three rows seeded via Supabase MCP `execute_sql` (replace `<USER_ID>` and `<GAME_KEY>` with values for an existing admin / draft game):

```sql
-- a) Always active (both null)
INSERT INTO custom_missions (user_id, name, icon, desc, difficulty, max_pts, type, data)
VALUES ('<USER_ID>', 'Always Mission', '⭐', '', 'easy', 300, 'photo', '{"prompt":"x"}');

-- b) Active window in the future — should NOT appear
INSERT INTO custom_missions (user_id, name, icon, desc, difficulty, max_pts, type, data, active_from, active_until)
VALUES ('<USER_ID>', 'Future Mission', '⏳', '', 'easy', 300, 'photo', '{"prompt":"x"}',
        (now() + interval '7 days'), (now() + interval '14 days'));

-- c) Active window covering now — should appear
INSERT INTO custom_missions (user_id, name, icon, desc, difficulty, max_pts, type, data, active_from, active_until)
VALUES ('<USER_ID>', 'Live Mission', '🟢', '', 'easy', 300, 'photo', '{"prompt":"x"}',
        (now() - interval '1 day'), (now() + interval '1 day'));
```

Then call `/api/team/login` with that game's key:

```bash
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"name":"TestTeam","gameKey":"<GAME_KEY>"}' \
  http://localhost:3000/api/team/login | python3 -c 'import sys,json; r=json.load(sys.stdin); print([m["name"] for m in r.get("customMissions",[])])'
```

Expected: `['Always Mission', 'Live Mission']` (order may vary by `sort_order`/`created_at`). `Future Mission` must be absent. Clean up the seed rows when done.

- [ ] **Step 4: Commit**:

```bash
git add app/api/team/login/route.ts
git commit -m "feat: hide out-of-window custom missions from team login"
```

---

## Task 6: AdminScreen — Feature 1 (Hide already played) + Feature 2 (excludedNames wiring)

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

- [ ] **Step 1: Add state for played-mission IDs and the toggle.** Find:

```typescript
  const [adminCustomMissions, setAdminCustomMissions] = useState<import('@/lib/supabase').CustomMission[]>([]);
```

and insert *immediately after* that line:

```typescript
  const [playedMissionIds, setPlayedMissionIds] = useState<string[]>([]);
  const [hidePlayedMissions, setHidePlayedMissions] = useState<boolean>(false);
```

- [ ] **Step 2: Fetch played IDs on mount.** Find:

```typescript
  useEffect(() => { loadGames(); }, [loadGames]);
```

and *immediately after* that line, add:

```typescript
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/played-missions', {
          headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json() as { playedIds?: string[] };
        if (!cancelled && Array.isArray(data.playedIds)) {
          setPlayedMissionIds(data.playedIds);
        }
      } catch {
        // Non-fatal — toggle simply has no effect.
      }
    })();
    return () => { cancelled = true; };
  }, [authToken]);
```

- [ ] **Step 3: Add the "Hide already played" toggle in the picker header.** Find:

```typescript
            <label className="form-label" style={{ margin: 0 }}>Select Missions ({selectedMissions.length} selected)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setSelectedMissions(MISSIONS.map(m => m.id))}>All on</button>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setSelectedMissions([])}>All off</button>
            </div>
```

and replace with:

```typescript
            <label className="form-label" style={{ margin: 0 }}>Select Missions ({selectedMissions.length} selected)</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--muted)', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={hidePlayedMissions}
                  onChange={e => setHidePlayedMissions(e.target.checked)}
                  style={{ margin: 0 }}
                />
                Hide already played{playedMissionIds.length > 0 ? ` (${playedMissionIds.length})` : ''}
              </label>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setSelectedMissions(MISSIONS.map(m => m.id))}>All on</button>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setSelectedMissions([])}>All off</button>
            </div>
```

- [ ] **Step 4: Filter MISSIONS in the category map.** Find:

```typescript
              const catMissions = MISSIONS.filter(m => MISSION_SUPER_CATEGORY[m.id] === catKey);
              if (catMissions.length === 0) return null;
```

and replace with:

```typescript
              const playedSet = new Set(playedMissionIds);
              const catMissions = MISSIONS
                .filter(m => MISSION_SUPER_CATEGORY[m.id] === catKey)
                .filter(m => !hidePlayedMissions || !playedSet.has(m.id));
              if (catMissions.length === 0) return null;
```

- [ ] **Step 5: Filter custom missions the same way.** Find:

```typescript
            {adminCustomMissions.length > 0 && (() => {
              const buckets = new Map<string | null, typeof adminCustomMissions>();
              for (const m of adminCustomMissions) {
                const key = m.category_id ?? null;
                if (!buckets.has(key)) buckets.set(key, []);
                buckets.get(key)!.push(m);
              }
```

and replace with:

```typescript
            {adminCustomMissions.length > 0 && (() => {
              const playedSet = new Set(playedMissionIds);
              const visibleCustom = hidePlayedMissions
                ? adminCustomMissions.filter(m => !playedSet.has(m.id))
                : adminCustomMissions;
              if (visibleCustom.length === 0) return null;
              const buckets = new Map<string | null, typeof visibleCustom>();
              for (const m of visibleCustom) {
                const key = m.category_id ?? null;
                if (!buckets.has(key)) buckets.set(key, []);
                buckets.get(key)!.push(m);
              }
```

> **Note:** the existing block then references `adminCustomMissions` further down (e.g. `for (const cat of adminCategories) { if (buckets.has(cat.id)) groups.push({ cat, missions: buckets.get(cat.id)! }); }`). The buckets Map already only contains `visibleCustom`, so the rest works unchanged.

- [ ] **Step 6: Compute and send `excludedNames` from the latest game.** In `generateWithAI()`, find:

```typescript
          body: JSON.stringify({
            prompt: aiPrompt,
            ...(aiType ? { type: aiType } : {}),
            language: aiLanguage,
          }),
```

and replace with:

```typescript
          body: JSON.stringify({
            prompt: aiPrompt,
            ...(aiType ? { type: aiType } : {}),
            language: aiLanguage,
            excludedNames: (() => {
              // Names of standard + custom missions used in the most recently created game.
              const newest = [...games].sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0];
              if (!newest || !Array.isArray(newest.missions)) return [];
              const customById = new Map(adminCustomMissions.map(cm => [cm.id, cm.name] as const));
              const standardById = new Map(MISSIONS.map(m => [m.id, m.name] as const));
              const names: string[] = [];
              for (const id of newest.missions) {
                const n = customById.get(id) ?? standardById.get(id);
                if (n) names.push(n);
              }
              return names;
            })(),
          }),
```

> **Type assumption:** `Game` already exposes `created_at: string` and `missions: string[]`. If `Game.missions` is typed as `unknown` or `string[] | null`, the `Array.isArray` guard handles it. If `created_at` is missing from the type, change the sort key to `b.id.localeCompare(a.id)` as a fallback — but only after confirming with `grep -n "type Game\b\|interface Game\b" components/screens/AdminScreen.tsx lib/*.ts`.

- [ ] **Step 7: Typecheck**:

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 8: Manual verify**
  1. Start `npm run dev`, sign in as an admin who has at least one finished game.
  2. Open the create-game flow → the picker now shows the toggle. Tick it: previously-used missions should disappear (and `(N)` counter shows next to the label).
  3. Untick → all missions reappear.
  4. Open the AI mission panel, type a vague prompt like "general knowledge", generate → in DevTools Network tab, inspect the POST body to `/api/admin/ai-generate-mission`: `excludedNames` must contain the names of the most recent game's missions.

- [ ] **Step 9: Commit**:

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: hide-played-missions toggle and AI excludedNames wiring"
```

---

## Task 7: AdminScreen — Feature 3 (active window form fields)

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

- [ ] **Step 1: Extend `MissionFormData`.** Find:

```typescript
  // photo
  photoPrompt: string;
};
```

and replace with:

```typescript
  // photo
  photoPrompt: string;
  // seasonal window — ISO date strings ('' = unset)
  activeFrom: string;
  activeUntil: string;
};
```

- [ ] **Step 2: Extend `EMPTY_FORM`.** Find:

```typescript
const EMPTY_FORM: MissionFormData = {
  name: '', icon: '⭐', desc: '', difficulty: 'medium', maxPts: 500, type: '',
  triviaRounds: [], statements: [], closestQuestions: [],
  clues: [], paAnswer: '', timelineItems: [], photoPrompt: '',
};
```

and replace with:

```typescript
const EMPTY_FORM: MissionFormData = {
  name: '', icon: '⭐', desc: '', difficulty: 'medium', maxPts: 500, type: '',
  triviaRounds: [], statements: [], closestQuestions: [],
  clues: [], paAnswer: '', timelineItems: [], photoPrompt: '',
  activeFrom: '', activeUntil: '',
};
```

- [ ] **Step 3: Hydrate the two fields in `openEditForm`.** The existing call writes a full `MissionFormData` literal. Find:

```typescript
        photoPrompt: cm.type === 'photo' ? (d.prompt as string) ?? '' : '',
      });
      setMissionFormError('');
```

and replace with:

```typescript
        photoPrompt: cm.type === 'photo' ? (d.prompt as string) ?? '' : '',
        activeFrom: (cm as { active_from?: string | null }).active_from
          ? new Date((cm as { active_from: string }).active_from).toISOString().slice(0, 10)
          : '',
        activeUntil: (cm as { active_until?: string | null }).active_until
          ? new Date((cm as { active_until: string }).active_until).toISOString().slice(0, 10)
          : '',
      });
      setMissionFormError('');
```

> The `cm as { ... }` casts cover the case where `CustomMission` in `lib/supabase.ts` hasn't been updated yet. **Bonus step:** add `active_from?: string | null; active_until?: string | null;` to the `CustomMission` type in `lib/supabase.ts` to drop the casts — verify the file with `grep -n "CustomMission" lib/supabase.ts` first; only edit if the type is hand-maintained, not generated.

- [ ] **Step 4: Hydrate from AI generation.** Find:

```typescript
          photoPrompt: mission.photoPrompt ?? '',
        });
        setMissionFormError('');
        setMissionCategoryId(null);
        setShowMissionForm(true);
```

and replace with:

```typescript
          photoPrompt: mission.photoPrompt ?? '',
          activeFrom: '',
          activeUntil: '',
        });
        setMissionFormError('');
        setMissionCategoryId(null);
        setShowMissionForm(true);
```

- [ ] **Step 5: Send the values from `saveMission`.** Find:

```typescript
      const payload = {
        name: missionForm.name.trim(),
        icon: missionForm.icon || '⭐',
        desc: missionForm.desc,
        difficulty: missionForm.difficulty,
        max_pts: missionForm.maxPts,
        type: missionForm.type,
        data,
        category_id: missionCategoryId,
      };
```

and replace with:

```typescript
      const payload = {
        name: missionForm.name.trim(),
        icon: missionForm.icon || '⭐',
        desc: missionForm.desc,
        difficulty: missionForm.difficulty,
        max_pts: missionForm.maxPts,
        type: missionForm.type,
        data,
        category_id: missionCategoryId,
        active_from: missionForm.activeFrom
          ? new Date(`${missionForm.activeFrom}T00:00:00Z`).toISOString()
          : null,
        active_until: missionForm.activeUntil
          ? new Date(`${missionForm.activeUntil}T23:59:59Z`).toISOString()
          : null,
      };
```

> **Why start-of-day / end-of-day:** the date input gives `YYYY-MM-DD` only; we expand to a full UTC window so admins picking the same day for both ends still get a 24-hour active window rather than a zero-length one.

- [ ] **Step 6: Add the two date inputs to the form UI.** The existing form has a `difficulty` `<select>` around line 1909. Add the window block just below the `desc` and `difficulty` rows (before the type-specific editors). Search for the closing `</select>` of `difficulty` (find the unique pattern `setF({ difficulty: e.target.value as MissionFormData['difficulty'] })`) — the surrounding `<div>` wraps that field. Right after that wrapping `<div>` closes, insert:

```typescript
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
                        ACTIVE FROM (OPTIONAL)
                      </label>
                      <input
                        type="date"
                        value={missionForm.activeFrom}
                        onChange={e => setF({ activeFrom: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1px', display: 'block', marginBottom: '4px' }}>
                        ACTIVE UNTIL (OPTIONAL)
                      </label>
                      <input
                        type="date"
                        value={missionForm.activeUntil}
                        onChange={e => setF({ activeUntil: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  {missionForm.activeFrom && missionForm.activeUntil && missionForm.activeFrom > missionForm.activeUntil && (
                    <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--danger, #d33)' }}>
                      Active until must be on or after active from.
                    </div>
                  )}
```

> If the exact difficulty `</select>` wrapper is ambiguous, locate it precisely first:
>
> ```bash
> grep -n "MissionFormData\['difficulty'\]" components/screens/AdminScreen.tsx
> ```
>
> Insert the block immediately after the parent `<div>` of that `<select>` (one closing `</div>` after the select).

- [ ] **Step 7: Guard save when the range is reversed.** In `saveMission`, just before `setMissionSaving(true);`, add:

```typescript
      if (missionForm.activeFrom && missionForm.activeUntil && missionForm.activeFrom > missionForm.activeUntil) {
        setMissionFormError('Active until must be on or after active from.');
        return;
      }
```

- [ ] **Step 8: Typecheck**:

```bash
npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 9: Manual verify**
  1. Open My Missions → New custom mission. Pick a type, name it "Halloween", set Active From `2026-10-01`, Active Until `2026-11-01`. Save.
  2. Open the mission again — the two date inputs should display the saved values.
  3. Set Active From `2026-12-01` and Active Until `2026-11-01` → save shows "Active until must be on or after active from."
  4. Create a draft game including no missions but having one custom mission with `active_from = now()+1 day`. Have a team log in — Network tab → `/api/team/login` response: `customMissions` array does not include the future mission.
  5. Update `active_from` to `now()-1 day` via the form → team login now returns the mission.

- [ ] **Step 10: Commit**:

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: seasonal active window inputs on custom mission form"
```

If you bumped `lib/supabase.ts` to add the optional fields on `CustomMission`, include it in the same commit.

---

## Final verification

- [ ] **Step 1: Full typecheck**:

```bash
npx tsc --noEmit 2>&1 | tee /tmp/tsc.log | tail -20
```

Expect zero errors in any of the touched files. Pre-existing errors elsewhere are out of scope but should be noted.

- [ ] **Step 2: Smoke test the three features end-to-end** in the running dev server, using the verification steps above.

- [ ] **Step 3: Confirm git log** is clean and ordered:

```bash
git log --oneline -n 8
```

Expect (top to bottom, newest first):

1. `feat: seasonal active window inputs on custom mission form`
2. `feat: hide-played-missions toggle and AI excludedNames wiring`
3. `feat: hide out-of-window custom missions from team login`
4. `feat: accept active_from/active_until on custom-missions admin routes`
5. `feat: support excludedNames in AI mission generator`
6. `feat: add /api/admin/played-missions endpoint`
7. `db: add active_from/active_until to custom_missions`

- [ ] **Step 4 (optional, per user preference — no PR workflow): push to main**:

```bash
git push origin main
```

---

## Notes & gotchas

- **`Game.missions` typing.** The DB column is `text[]`. If the TS `Game` type narrows it, the `Array.isArray` guard in Task 6 Step 6 handles either shape; do not weaken the type.
- **PostgREST `.or()` semantics.** Chaining two `.or()` calls AND-combines them (each `or` is a parenthesized group). So `active_from is null OR active_from <= now` AND `active_until is null OR active_until >= now` — exactly the "now is inside the (possibly half-open) window" predicate we want.
- **Service-role client.** `/api/team/login` already uses the service role key, so the new filter runs without RLS interference. Do not add an RLS policy as part of this change.
- **Timezones.** Date inputs are calendar-day; expanding to `T00:00:00Z` / `T23:59:59Z` keeps a consistent UTC window. Teams in other timezones will see the mission for at least their full local day overlapping the UTC window, which matches the seasonal-pack mental model.
- **Pro gating.** `excludedNames` rides on the existing pro-gate in the AI route; no extra check needed.
- **No `updated_at` column on `games`.** The played-missions endpoint only reads `missions`, so this is fine.
- **No new tests.** This repo has no test runner. All verification is curl + manual UI + Supabase MCP `execute_sql`.
