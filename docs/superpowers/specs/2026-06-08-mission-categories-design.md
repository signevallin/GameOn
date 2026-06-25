# Mission Categories Design

## Goal

Let admins organise their custom missions into multiple named categories, each with a custom emoji. Categories replace the single hardcoded ⭐ label in the game creation view, giving admins full control over how their missions are grouped and presented.

## Architecture

### New database table: `custom_mission_categories`

```sql
CREATE TABLE custom_mission_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text NOT NULL,
  name        text NOT NULL,
  emoji       text NOT NULL DEFAULT '📋',
  sort_order  int  NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

RLS: users can only read/write their own rows (`user_id = auth.uid()` or service-role).

### Modified table: `custom_missions`

Add one nullable column:

```sql
ALTER TABLE custom_missions ADD COLUMN category_id uuid REFERENCES custom_mission_categories(id) ON DELETE SET NULL;
```

Existing rows keep `category_id = null` and fall back to the "Övrigt" group. The existing `category_name` column is left untouched (no migration needed).

### New API routes

**`app/api/admin/mission-categories/route.ts`**
- `GET` — returns all categories for the authenticated admin, ordered by `sort_order`
- `POST` — creates a new category `{ name, emoji }`; auto-assigns next `sort_order`
- `DELETE ?id=<uuid>` — deletes a category (missions with this `category_id` get `null` via `ON DELETE SET NULL`)

### Modified API route: `app/api/admin/custom-missions/route.ts`
- `POST` / `PUT` — accept optional `category_id` field alongside existing fields
- `GET` — return `category_id` in the mission payload

### Modified: `lib/custom-missions.ts`
- `toMission()` maps `category_id` through to the `Mission` shape (stored in `mission.categoryId`)

---

## Admin UI — AdminScreen.tsx changes

### New state
```typescript
adminCategories: Category[]          // loaded with custom missions
categoryFormOpen: boolean            // inline new-category row visible
categoryFormName: string
categoryFormEmoji: string
categorySaving: boolean
```

Where `Category = { id: string; name: string; emoji: string; sort_order: number }`.

### Category management section (My Missions view, above mission list)

Rendered when `view === 'missions'` and `!showMissionForm`:

```
🏀  Sport          [×]
🎵  Musik          [×]
[+ Ny kategori]
```

Clicking **+ Ny kategori** reveals an inline row:
```
[ 🏀 ] [ Namn...          ] [Spara]  [Avbryt]
```

- Emoji field: single-character text input, max 2 chars (emoji can be 2 code units)
- Name field: text input
- Save calls `POST /api/admin/mission-categories`
- Delete (×) calls `DELETE /api/admin/mission-categories?id=<id>`; updates local state immediately

### Mission form — category dropdown

A `KATEGORI` select is added above existing form fields:

```
KATEGORI
[ 🏀 Sport ▼ ]
  (Ingen kategori)
  🏀 Sport
  🎵 Musik
  ...
```

On save, the selected `category_id` (or `null`) is included in the API payload.

---

## Game Creation View — AdminScreen.tsx changes

Replace the current single `⭐ {catName.toUpperCase()}` heading logic with per-category grouping:

1. Build a map `categoryId → Category` from `adminCategories`
2. Group `adminCustomMissions` by `mission.categoryId` (null → "Övrigt" group)
3. Sort groups by `sort_order`; "Övrigt" always last
4. Render each group with `{category.emoji} {category.name.toUpperCase()}` as the heading

Missions without a `categoryId` render under `📋 ÖVRIGT`.

---

## Data Flow

```
Admin creates category
  → POST /api/admin/mission-categories
  → row inserted, returned
  → adminCategories state updated

Admin creates/edits mission with category
  → POST/PUT /api/admin/custom-missions (includes category_id)
  → row saved
  → mission list refreshed

Game creation view loads
  → loadAdminCustomMissions() — fetches missions with category_id
  → adminCategories already loaded
  → missions grouped by category in render
```

---

## Error States

| Scenario | Behaviour |
|---|---|
| Delete category with missions | `ON DELETE SET NULL` moves missions to Övrigt; no error |
| Empty category name | Client-side: disable Save button |
| Emoji field empty | Default to 📋 |
| API error on save | Inline error message, row stays open |

---

## Out of Scope

- Drag-to-reorder categories (sort_order is set by creation order only)
- Assigning multiple categories to one mission
- Category visibility toggles
