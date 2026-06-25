# Admin Onboarding Flow — Design Spec

**Goal:** Show new admins a 3-step modal wizard on first login, teaching them the core GameOn workflow, with a persistent Help entry point to re-open it at any time.

**Architecture:** Check `onboarded_at` on the existing `admin_branding` row after login; if null, render the modal. On completion or skip, call a new API endpoint that sets `onboarded_at`. A Help link in the profile dropdown re-opens the modal without resetting the flag.

**Tech stack:** Next.js App Router, React state in `AdminScreen.tsx`, Supabase (`admin_branding` table), existing `validateAdminToken` auth pattern.

---

## 1. Database

Add one nullable column to `admin_branding`:

```sql
ALTER TABLE admin_branding
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ DEFAULT NULL;
```

No migration file needed beyond running this SQL in Supabase. The column defaults to `NULL` for all existing rows — existing admins will not see the onboarding modal (their rows already exist; a missing row also counts as "not onboarded" and will be created on first use of branding or onboarding completion).

---

## 2. API

### `POST /api/admin/onboarding/complete`

Marks the current admin as onboarded. Idempotent — calling it multiple times is safe.

**Auth:** `validateAdminToken` (same pattern as all other admin routes).

**Body:** none required.

**Logic:**
```typescript
await supabase
  .from('admin_branding')
  .upsert({ user_id: admin.userId, onboarded_at: new Date().toISOString() }, { onConflict: 'user_id' });
```

**Response:** `{ ok: true }`

### `GET /api/admin/branding` (existing — extend response)

Already fetches the `admin_branding` row. Add `onboarded_at` to the selected columns so the frontend can read it in one request.

Change `.select('brand_logo_url, brand_primary_color, brand_name, apply_to_all_games')` to also include `onboarded_at`.

---

## 3. Frontend — `AdminScreen.tsx`

### State

```typescript
const [showOnboarding, setShowOnboarding] = useState(false);
const [onboardingStep, setOnboardingStep] = useState(0); // 0-based, 0–2
```

### Trigger

In the existing `loadBranding` fetch (called on mount), check the returned `onboarded_at`:

```typescript
if (!data.onboarded_at) setShowOnboarding(true);
```

### Completion

Both "Create my first game" (step 3 CTA) and "Skip tour" call:

```typescript
async function completeOnboarding() {
  setShowOnboarding(false);
  await fetch('/api/admin/onboarding/complete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (onboardingStep === 2) setView('templates'); // jump to create-game flow
}
```

### Help entry point

In the existing profile dropdown menu, add a new item above the existing entries:

```tsx
<button onClick={() => { setShowProfile(false); setOnboardingStep(0); setShowOnboarding(true); }}>
  ❓ How it works
</button>
```

Reopening via Help does **not** call `complete` again — `onboarded_at` stays set.

---

## 4. Onboarding Modal Component

A new component `OnboardingModal` rendered inside `AdminScreen` when `showOnboarding` is true. Rendered as a fixed overlay (z-index above all other content).

### Steps (0-indexed)

| # | Icon | Title | Body |
|---|------|-------|------|
| 0 | 🎮 | Welcome to GameOn | "Create and run live scavenger hunts & team games in minutes. Here's how it works:" + 3 bullets: (1) Pick missions from the library or create your own, (2) Share the game code — teams join on their phones, (3) Watch scores update live and control the game from here |
| 1 | 🗺️ | Create your first game | "Tap + New Game to pick a template, choose missions, and set a time limit. It takes less than 2 minutes." + 3 bullets: (1) Start from a template or build from scratch, (2) Mix standard missions with your own custom ones, (3) Add custom branding for your organisation |
| 2 | 🚀 | You're ready to play | "Share the 4-letter game code with your teams. Once everyone's joined, hit Start Game from the dashboard." + 3 bullets: (1) Teams join at playgameon.app — no app download needed, (2) Live leaderboard updates as missions are completed, (3) Rate photo submissions manually or let AI do it automatically |

### Visual design

Matches GameOn's existing dark theme exactly:

- **Backdrop:** fixed full-screen overlay, `background: rgba(10,14,25,0.75)`, `z-index: 1000`
- **Modal card:** `background: var(--card)`, `border: 1px solid var(--border)`, `border-radius: 14px`, max-width 440px, centered
- **Top accent bar:** 3px gradient `linear-gradient(90deg, var(--accent), var(--accent-hover))`
- **Progress:** 3 pill-shaped bars below the accent bar; active = `var(--accent)`, completed = `var(--accent)` at 45% opacity, upcoming = `var(--border)`
- **Step icon:** 52×52px rounded square, `background: var(--accent-dim)`, `border: 1px solid var(--accent-border)`
- **Buttons:** existing `.btn-primary` and `.btn-ghost` classes
- **Close (✕):** top-right, calls `completeOnboarding()`

### Navigation

- Steps 0–1: "Skip tour" (left) + step counter + "Next →" (right)
- Step 2: "← Back" (left) + "Create my first game 🎉" (right, calls `completeOnboarding()`)
- Back button on step 0 is hidden

---

## 5. What is NOT in scope

- No video or animated walkthrough
- No tooltips or spotlight overlays pointing at UI elements
- No re-onboarding prompt after a long period of inactivity
- The Help modal does not reset `onboarded_at`
