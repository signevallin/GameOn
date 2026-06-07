# Game Templates Design

**Date:** 2026-06-07
**Status:** Approved

---

## Goal

Let admins start game creation from a pre-selected mission list ("template") instead of always picking missions from scratch. Built-in templates ship with the app; admins can also save any game as a personal template. SuperAdmins can create, edit, and delete built-in templates from a dedicated management page.

## Breakpoint / Scope

This feature touches:
- A new Supabase table and migration
- Three new API routes
- Two new views in AdminScreen (`templates` and `manage-templates`)
- One new button on the games list ("Save as template")

---

## Data Model

### `game_templates` table

```sql
create table game_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  icon         text not null default '🎮',
  description  text,
  mission_ids  text[] not null default '{}',
  is_builtin   boolean not null default false,
  user_id      uuid references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);
```

- **Built-in templates:** `is_builtin = true`, `user_id = null`. Created/edited/deleted only by superadmins via service-role API.
- **Admin templates:** `is_builtin = false`, `user_id = <admin_id>`. Scoped to the creating admin.

### Row Level Security

```sql
alter table game_templates enable row level security;

-- All authenticated users can read all templates
create policy "read all templates"
  on game_templates for select
  using (auth.uid() is not null);

-- Admins can insert their own non-builtin templates
create policy "insert own templates"
  on game_templates for insert
  with check (auth.uid() = user_id and is_builtin = false);

-- Admins can update their own non-builtin templates
create policy "update own templates"
  on game_templates for update
  using (auth.uid() = user_id and is_builtin = false);

-- Admins can delete their own non-builtin templates
create policy "delete own templates"
  on game_templates for delete
  using (auth.uid() = user_id and is_builtin = false);
```

Built-in template mutations (insert/update/delete where `is_builtin = true`) go through the API using the service role key — RLS is intentionally not bypassed for regular admins on built-ins.

### TypeScript type

```typescript
// lib/types.ts (or wherever shared types live)
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
```

---

## Seed Data

Three built-in templates inserted via migration:

**🍻 After Work** — Relaxed social mix, 14 missions:
`trivia_fun`, `wouldyou`, `photo_bubble`, `photo_movie_scene`, `music_quiz`, `finish_lyrics`, `music_emoji`, `mix_drinks`, `celebrity_quiz`, `movie_emoji`, `logo_quiz`, `pictionary`, `duel_trivia`, `closest_wins`

**💻 IT Onboarding** — Tech-focused, 12 missions:
`code_quiz`, `binary`, `bug_hunt`, `terminal`, `app_icons`, `spot_error`, `typerace`, `wordguess`, `anagram`, `true_false`, `timeline`, `trivia_fun`

**🎉 Team Kickoff** — Energetic team-building, 13 missions:
`human_statue`, `photo_mirror_selfie`, `photo_ad_shot`, `photo_colour_match`, `photo_weird_sign`, `reaction`, `memory`, `wouldyou`, `scavenger_hunt`, `duel_trivia`, `geo_guess`, `emoji_rebus`, `flag_quiz`

---

## API Routes

### `GET /api/admin/templates`
Returns built-in templates (all) plus the calling admin's own templates, merged and sorted (built-ins first, then own by `created_at` desc).

Response:
```json
{ "templates": GameTemplate[] }
```

### `POST /api/admin/templates`
Creates a template.

Request body:
```json
{
  "name": "string",
  "icon": "string",
  "description": "string | null",
  "missionIds": "string[]",
  "isBuiltin": "boolean"
}
```

- `isBuiltin: true` requires superadmin check — same pattern as `app/api/admin/superadmin/analytics/route.ts`. Uses service role key to bypass RLS.
- `isBuiltin: false` inserts with `user_id = caller`.

Response: `{ "template": GameTemplate }`

### `PUT /api/admin/templates/[id]`
Updates a template's name, icon, description, or missionIds.

- Built-in templates: superadmin only, service role key.
- Own templates: caller must own it.

Request body: same fields as POST (all optional).
Response: `{ "template": GameTemplate }`

### `DELETE /api/admin/templates/[id]`
Deletes a template.

- Built-in: superadmin only.
- Own: caller must own it.

Response: `{ "success": true }`

---

## UI

### View: `templates` (all admins)

New view in AdminScreen triggered when admin clicks "+ NEW GAME" (currently sets `view = 'create'` — now sets `view = 'templates'` first).

Layout:
- Back button → `view = 'games'`
- Heading: "Choose a starting point"
- Section **"Built-in templates"** — list of built-in `GameTemplate` rows, each showing icon, name, mission count. Clicking one navigates to `view = 'create'` with those `missionIds` pre-selected.
- Section **"My templates"** — list of admin's own templates with same row style, plus a delete (🗑) button. Empty state: "No saved templates yet".
- Row at bottom: **"Blank game"** (✏️) — navigates to `view = 'create'` with no pre-selection.

### View: `manage-templates` (superadmin only)

Accessible from the games list view: a "Manage Templates" button visible only when `isSuperAdmin === true`.

Layout:
- Back button → `view = 'games'`
- Heading: "Manage Templates" / subtitle "Edit built-in templates visible to all admins"
- "+ NEW TEMPLATE" button (accent)
- List of all built-in templates — each row: icon, name, mission count, ✏️ Edit button, 🗑 Delete button
- Inline edit form (expands below the row when Edit is clicked): name text input, icon text input, mission multi-select (same mission picker as create-game). Save / Cancel buttons.
- Delete shows a confirm prompt before calling DELETE API.

### Games list: "Save as template" button

Each game card in the games list (`view = 'games'`) gets a "Save as template" ghost button. Clicking it:
1. Opens an inline prompt: text input for template name (pre-filled with game name), emoji input for icon (pre-filled with 🎮), confirm button.
2. Calls `POST /api/admin/templates` with `isBuiltin: false`.
3. Shows success toast.

### Create game: pre-filled missions

`view = 'create'` receives an optional `templateMissionIds: string[]` prop/state. When set, the mission multi-select is pre-checked with those IDs on mount. Admin can add/remove freely before creating the game.

---

## State changes in AdminScreen

```typescript
type AdminView = 'games' | 'dashboard' | 'create' | 'missions' | 'templates' | 'manage-templates';

// New state
const [templateMissionIds, setTemplateMissionIds] = useState<string[]>([]);
```

- "+ NEW GAME" button: `setTemplateMissionIds([]); setView('templates')`
- Template selected: `setTemplateMissionIds(template.missionIds); setView('create')`
- Blank game: `setTemplateMissionIds([]); setView('create')`
- Create-game view reads `templateMissionIds` to pre-check missions on mount

---

## Out of scope

- Template sharing between admins (each admin's custom templates are private)
- Template duplication
- Reordering missions within a template
- Template categories/tags
