# Progress Tab — Custom Missions Design Spec

## Goal

The Progress tab in the admin dashboard currently only shows built-in missions (grouped by `SUPER_CATEGORIES`). Custom missions included in the game are silently absent. Fix it so the tab shows every mission that is actually in the game, grouped by its category.

---

## Root Cause

In `components/screens/AdminScreen.tsx`, the `tab === 'progress'` block builds category groups like this:

```typescript
const catGroups = (Object.keys(SUPER_CATEGORIES) as SuperCategoryKey[]).map(catKey => ({
  catKey,
  missions: activeGame.missions
    .map(id => MISSIONS.find(x => x.id === id))   // ← only finds built-in missions
    .filter((m) => !!m && MISSION_SUPER_CATEGORY[m.id] === catKey),
})).filter(g => g.missions.length > 0);
```

Custom missions have UUID IDs not in the `MISSIONS` array, so `.find()` returns `undefined` and they are filtered out.

---

## Data Already Available

Both are loaded on mount via `loadAdminCustomMissions()`:
- `adminCustomMissions: CustomMission[]` — all custom missions for this admin
- `adminCategories: AdminCategory[]` — their categories (`id`, `name`, `emoji`, `sort_order`)

`activeGame.missions: string[]` — the complete list of mission IDs in the game (mix of built-in IDs and custom UUID IDs).

---

## Fix: Extend the Progress Tab

**File:** `components/screens/AdminScreen.tsx`, `tab === 'progress'` block (lines ~3612–3692).

### Step 1 — Custom mission groups

After computing `catGroups` (built-in), compute custom groups:

```typescript
// Custom missions in this game
const customInGame = adminCustomMissions.filter(cm =>
  activeGame.missions.includes(cm.id)
);

// Group by category_id
const customByCatId = new Map<string | null, typeof customInGame>();
for (const cm of customInGame) {
  const key = cm.category_id ?? null;
  if (!customByCatId.has(key)) customByCatId.set(key, []);
  customByCatId.get(key)!.push(cm);
}

// Build ordered groups: named categories first (by sort_order), uncategorized last
const customGroups: { cat: AdminCategory | null; missions: typeof customInGame }[] = [];
for (const cat of [...adminCategories].sort((a, b) => a.sort_order - b.sort_order)) {
  const missions = customByCatId.get(cat.id) ?? [];
  if (missions.length > 0) customGroups.push({ cat, missions });
}
const uncategorized = customByCatId.get(null) ?? [];
if (uncategorized.length > 0) customGroups.push({ cat: null, missions: uncategorized });
```

### Step 2 — Render custom groups after built-in groups

Each custom group renders the same table structure as built-in groups:
- Header: `{cat.emoji} {cat.name}` — or `📋 Övriga` for uncategorized
- Header color: `var(--muted)` (no color assigned to custom categories)
- Columns: one per custom mission, header shows `cm.icon` (tooltip `cm.name`)
- Cells: same completion dot + points logic, using `t.completed?.includes(cm.id)` and `t.mission_scores?.[cm.id]`

### Rendering order

1. Built-in super-category groups (unchanged)
2. Custom category groups (new)
3. Uncategorized custom missions under "📋 Övriga" (new, only if any exist)
4. Total Score summary (unchanged)

---

## Out of Scope

- Changing built-in mission grouping
- Showing custom missions anywhere other than the progress tab
- Mixing custom and built-in missions in the same table row
