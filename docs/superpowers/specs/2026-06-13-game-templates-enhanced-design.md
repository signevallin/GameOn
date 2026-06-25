# Enhanced Game Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three connected enhancements to game templates: seasonal date-range visibility, AI-suggested descriptions on manual templates, and full AI-generated templates (with new mission creation if needed).

**Architecture:** Extend the existing `game_templates` table with two `TEXT` date columns (`active_from`, `active_to` in `MM-DD` format). Add two new API endpoints for AI features. Update the existing templates API and UI to surface all new fields. Visibility filtering lives in the API layer.

**Tech Stack:** Next.js App Router, Supabase (service role), Anthropic SDK (claude-haiku-4-5 for descriptions, claude-sonnet-4-6 for generation), React (inline styles, existing patterns in AdminScreen.tsx)

---

## Data Model

### `game_templates` table — new columns

```sql
ALTER TABLE game_templates
  ADD COLUMN active_from TEXT DEFAULT NULL,  -- "MM-DD", e.g. "10-01"
  ADD COLUMN active_to   TEXT DEFAULT NULL;  -- "MM-DD", e.g. "10-31"
```

Both columns are `NULL` by default (always visible). A template with `active_from = "10-01"` and `active_to = "10-31"` is only shown to regular admins during October. Spans crossing the new year are supported (e.g. `"12-20"` → `"01-05"`).

### `GameTemplate` interface (`lib/templates.ts`)

Add two fields:
```ts
activeFrom: string | null;  // "MM-DD" or null
activeTo:   string | null;  // "MM-DD" or null
```

Remove `durationMinutes` — not part of this feature.

---

## Visibility Rules

A helper function `isTemplateActive(activeFrom, activeTo): boolean` evaluates whether today falls within the date range:

- If both are `null` → always active
- If only one is set → treat as always active (incomplete config)
- If `activeFrom <= activeTo` → active if today is between them (same year)
- If `activeFrom > activeTo` → active if today is after `activeFrom` OR before `activeTo` (crosses new year)

**API filtering:**
- `GET /api/admin/templates`: regular admins only receive templates where `isTemplateActive()` returns `true`. Superadmins receive all templates regardless.
- Manage-templates view (superadmin only): all templates visible, inactive ones shown with a muted "Seasonal — inactive" badge.

---

## API Changes

### Updated: `GET /api/admin/templates`

- Add `active_from, active_to` to SELECT
- Regular admins: filter out templates outside their active date range
- Superadmins: return all templates

### Updated: `POST /api/admin/templates`

Accept `activeFrom` and `activeTo` in body (optional, both or neither).

### Updated: `PATCH /api/admin/templates/[id]`

Accept `activeFrom` and `activeTo` in body.

### Updated: `toGameTemplate()` in `lib/templates.ts`

Map `active_from` → `activeFrom`, `active_to` → `activeTo`.

---

## New Endpoints

### `POST /api/admin/templates/describe`

Suggests an AI-generated description for a manually created template.

**Request:**
```json
{ "name": "Halloween Hunt", "missionIds": ["uuid1", "uuid2"] }
```

**Server logic:**
1. Fetch mission titles for the given IDs from `missions` table
2. Call Claude (claude-haiku-4-5) with a prompt: given the template name and mission list, write a 1–2 sentence description for an event organizer
3. Return `{ description: string }`

**Error:** returns `{ error: string }` with status 500 on Claude failure.

---

### `POST /api/admin/templates/generate`

Fully AI-generates a template from a free-text prompt, creating new missions if needed.

**Request:**
```json
{ "prompt": "Halloween scavenger hunt for 8 teams, spooky and fun, around 45 minutes" }
```

**Server logic:**
1. Fetch all available missions for this admin (builtin + own) — id, title, type, points
2. Call Claude (claude-sonnet-4-6) with structured prompt including the mission pool and user's event description
3. Claude returns JSON:
```json
{
  "name": "Halloween Hunt",
  "icon": "🎃",
  "description": "A spooky scavenger hunt...",
  "activeFrom": "10-01",
  "activeTo": "10-31",
  "selectedMissionIds": ["uuid1", "uuid2"],
  "newMissions": [
    {
      "title": "Find a spider web",
      "type": "photo",
      "points": 150,
      "description": "Photograph a real spider web"
    }
  ]
}
```
4. Return the parsed JSON to the client (do NOT persist yet — frontend shows preview first)

**Error handling:** if Claude returns malformed JSON, return `{ error: "generation_failed" }` with status 500.

---

## UI Changes (AdminScreen.tsx)

### Template creation / edit form (manage-templates view)

Add to both the "New template" form and the "Edit template" form:

**Description field:**
- Textarea (3 rows), placeholder: "What's this template about?"
- "✨ Suggest" button next to the label — calls `/api/admin/templates/describe` with current name + selected missions, fills the textarea, button shows spinner while loading
- Button is disabled if name or missions are empty

**Seasonal date range:**
- Label: "Show only between"
- Two pairs of dropdowns: one for month (Jan–Dec) and one for day (1–31), matching the `MM-DD` storage format. Each pair renders as `[Month ▾] [Day ▾]`.
- Displayed as: `From [____] To [____]` on one line
- If both empty: template is always visible
- Only visible/editable in the manage-templates view (superadmin)

### "Generate with AI" button

Add a `✨ Generate with AI` button in the templates view header (next to existing "New template" button). Opens a modal:

1. **Prompt step:** Textarea with placeholder *"Describe your event — theme, duration, number of teams, vibe..."* + `Generate` button
2. **Preview step** (after generation):
   - Shows: icon, name, description, seasonal range (if set), list of missions (existing ones marked normally, new ones marked with a `NEW` chip)
   - Buttons: `Save template` and `Discard`
3. **Saving:** on `Save template`:
   - Create any `newMissions` via existing missions API
   - Then POST to `/api/admin/templates` with all mission IDs (existing + newly created)
   - Close modal, refresh templates list, show success toast

### Template card in select-template view

If a template has `activeFrom`/`activeTo`, show a small date badge on the card: e.g. `🗓 Oct 1 – Oct 31`.

---

## File Structure

| File | Change |
|---|---|
| `lib/templates.ts` | Add `activeFrom`, `activeTo` to interface and `toGameTemplate()` |
| `lib/template-utils.ts` | New — exports `isTemplateActive(activeFrom, activeTo): boolean` |
| `app/api/admin/templates/route.ts` | Filter by date for non-superadmins; accept new fields |
| `app/api/admin/templates/[id]/route.ts` | Accept and persist new fields |
| `app/api/admin/templates/describe/route.ts` | New endpoint |
| `app/api/admin/templates/generate/route.ts` | New endpoint |
| `components/screens/AdminScreen.tsx` | UI: description field, date range pickers, AI generate modal |

---

## Out of Scope

- Template previews / thumbnail images
- Sharing templates between admins
- Analytics on template usage
- AI generating missions with images
