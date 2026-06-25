# Admin Onboarding Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show new admins a 3-step modal wizard on first login that teaches the core GameOn workflow, with a persistent Help entry in the profile dropdown to re-open it at any time.

**Architecture:** Add `onboarded_at TIMESTAMPTZ` to `admin_branding`. Fetch it alongside existing branding data on mount. If null, render `OnboardingModal`. On completion or skip, call `POST /api/admin/onboarding/complete` which upserts the timestamp. The profile dropdown gets a "❓ How it works" entry that reopens the modal without resetting the flag.

**Tech Stack:** Next.js App Router API routes, React state, Supabase (`admin_branding` table), existing `validateAdminToken` auth pattern, Sora font, GameOn CSS variables.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `admin_branding` table (Supabase) | Alter | Add `onboarded_at TIMESTAMPTZ DEFAULT NULL` |
| `app/api/admin/branding/route.ts` | Modify | Include `onboarded_at` in GET select + `BrandingSettings` type |
| `app/api/admin/onboarding/route.ts` | Create | `POST` that upserts `onboarded_at` for current user |
| `components/screens/AdminScreen.tsx` | Modify | Add state, branding fetch on mount, `OnboardingModal` component, Help button |

---

## Task 1: Add `onboarded_at` column to Supabase

**Files:**
- Supabase SQL editor (no local file)

- [ ] **Step 1: Run the migration SQL**

Open the Supabase dashboard → SQL Editor and run:

```sql
ALTER TABLE admin_branding
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ DEFAULT NULL;
```

Expected: "Success. No rows returned."

Existing rows keep `onboarded_at = NULL` — those users won't see the modal because their rows already exist (the modal is only shown when the value is null AND the row exists or is missing). New users who have never touched branding will also have no row — both are treated the same way by the frontend check `if (!data.onboarded_at)`.

- [ ] **Step 2: Verify the column exists**

In the SQL Editor run:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'admin_branding' AND column_name = 'onboarded_at';
```

Expected: one row with `data_type = timestamp with time zone`, `column_default = NULL`.

---

## Task 2: Extend branding GET to return `onboarded_at`

**Files:**
- Modify: `app/api/admin/branding/route.ts:15-38`

- [ ] **Step 1: Update `BrandingSettings` type**

In `app/api/admin/branding/route.ts`, change the exported type from:

```typescript
export type BrandingSettings = {
  brand_logo_url: string | null;
  brand_primary_color: string | null;
  brand_name: string | null;
  apply_to_all_games: boolean;
};
```

to:

```typescript
export type BrandingSettings = {
  brand_logo_url: string | null;
  brand_primary_color: string | null;
  brand_name: string | null;
  apply_to_all_games: boolean;
  onboarded_at: string | null;
};
```

- [ ] **Step 2: Update the SELECT query and response**

Change the `.select(...)` call and return value in the GET handler from:

```typescript
  const { data } = await adminClient()
    .from('admin_branding')
    .select('brand_logo_url, brand_primary_color, brand_name, apply_to_all_games')
    .eq('user_id', admin.userId)
    .maybeSingle();

  return NextResponse.json<BrandingSettings>({
    brand_logo_url: data?.brand_logo_url ?? null,
    brand_primary_color: data?.brand_primary_color ?? null,
    brand_name: data?.brand_name ?? null,
    apply_to_all_games: data?.apply_to_all_games ?? false,
  });
```

to:

```typescript
  const { data } = await adminClient()
    .from('admin_branding')
    .select('brand_logo_url, brand_primary_color, brand_name, apply_to_all_games, onboarded_at')
    .eq('user_id', admin.userId)
    .maybeSingle();

  return NextResponse.json<BrandingSettings>({
    brand_logo_url: data?.brand_logo_url ?? null,
    brand_primary_color: data?.brand_primary_color ?? null,
    brand_name: data?.brand_name ?? null,
    apply_to_all_games: data?.apply_to_all_games ?? false,
    onboarded_at: data?.onboarded_at ?? null,
  });
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `BrandingSettings` or `onboarded_at`.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/branding/route.ts
git commit -m "feat: include onboarded_at in branding GET response"
```

---

## Task 3: Create `POST /api/admin/onboarding/complete` endpoint

**Files:**
- Create: `app/api/admin/onboarding/route.ts`

- [ ] **Step 1: Create the file**

Create `app/api/admin/onboarding/route.ts` with this content:

```typescript
// app/api/admin/onboarding/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  const { error } = await adminClient()
    .from('admin_branding')
    .upsert(
      { user_id: admin.userId, onboarded_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start the dev server (`npm run dev`), log in as an admin, open DevTools → Network, and run in the console:

```javascript
const token = (await (await fetch('/api/admin/subscription', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${document.cookie}` } })).json());
// Instead, grab token from localStorage or the React state inspector
```

Easier: in the Supabase dashboard → Table Editor → `admin_branding`, verify the row for your test user has `onboarded_at = NULL` before the test, then call:

```bash
curl -X POST http://localhost:3000/api/admin/onboarding/complete \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected: `{"ok":true}` and the row in Supabase now has a non-null `onboarded_at`.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/onboarding/route.ts
git commit -m "feat: add POST /api/admin/onboarding/complete endpoint"
```

---

## Task 4: Add onboarding state and branding fetch to `AdminScreen`

**Files:**
- Modify: `components/screens/AdminScreen.tsx:666-803` (state declarations and mount useEffect)

- [ ] **Step 1: Add two state variables after the existing state block**

Find the line `const [toasts, setToasts] = useState<...` (around line 773) — it's the last state variable before the mount `useEffect`. Add these two lines directly after it:

```typescript
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
```

- [ ] **Step 2: Add branding fetch inside the mount useEffect**

Find this block inside the `useEffect` at line ~782:

```typescript
      if (token) {
        fetch('/api/admin/subscription', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }).then(r => r.json()).then(d => { if (d.plan) setPlan(d.plan); }).catch(() => {});
        loadAdminCustomMissions();
      }
```

Change it to:

```typescript
      if (token) {
        fetch('/api/admin/subscription', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }).then(r => r.json()).then(d => { if (d.plan) setPlan(d.plan); }).catch(() => {});
        loadAdminCustomMissions();
        fetch('/api/admin/branding', { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.json())
          .then(d => { if (!d.onboarded_at) setShowOnboarding(true); })
          .catch(() => {});
      }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: fetch onboarded_at on mount and set showOnboarding state"
```

---

## Task 5: Add `OnboardingModal` component to `AdminScreen`

**Files:**
- Modify: `components/screens/AdminScreen.tsx` — add component before `export default function AdminScreen`

- [ ] **Step 1: Add the `completeOnboarding` function and `OnboardingModal` component**

Find the line `function BrandingView(` (around line 515). Insert the following block **immediately before** it:

```typescript
const ONBOARDING_STEPS = [
  {
    icon: '🎮',
    title: 'Welcome to GameOn',
    subtitle: 'Create and run live scavenger hunts & team games in minutes. Here\'s how it works:',
    bullets: [
      'Pick missions from the library or create your own',
      'Share the game code — teams join on their phones',
      'Watch scores update live and control the game from here',
    ],
  },
  {
    icon: '🗺️',
    title: 'Create your first game',
    subtitle: 'Tap + New Game to pick a template, choose missions, and set a time limit. It takes less than 2 minutes.',
    bullets: [
      'Start from a template or build from scratch',
      'Mix standard missions with your own custom ones',
      'Add custom branding for your organisation',
    ],
  },
  {
    icon: '🚀',
    title: "You're ready to play",
    subtitle: 'Share the 4-letter game code with your teams. Once everyone\'s joined, hit Start Game from the dashboard.',
    bullets: [
      'Teams join at playgameon.app — no app download needed',
      'Live leaderboard updates as missions are completed',
      'Rate photo submissions manually or let AI do it automatically',
    ],
  },
];

function OnboardingModal({
  step,
  onNext,
  onBack,
  onSkip,
  onFinish,
}: {
  step: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const s = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,14,25,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        width: '100%', maxWidth: '440px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Sora', sans-serif",
      }}>
        {/* Top accent bar */}
        <div style={{
          height: '3px',
          background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
        }} />

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Close button */}
          <button
            onClick={onSkip}
            style={{
              position: 'absolute', top: '14px', right: '14px',
              background: 'transparent', border: 'none',
              color: 'var(--muted)', fontSize: '18px', cursor: 'pointer',
              lineHeight: 1, padding: '4px',
            }}
            aria-label="Close"
          >✕</button>

          {/* Progress bars */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
            {ONBOARDING_STEPS.map((_, i) => (
              <div key={i} style={{
                height: '4px', flex: 1, borderRadius: '2px',
                background: i < step
                  ? 'rgba(117,171,200,0.45)'
                  : i === step
                    ? 'var(--accent)'
                    : 'var(--border)',
              }} />
            ))}
          </div>

          {/* Step icon */}
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px',
            background: 'var(--accent-dim)',
            border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', marginBottom: '16px',
          }}>
            {s.icon}
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: '18px', fontWeight: 700, color: 'var(--text)',
            marginBottom: '8px', lineHeight: 1.3,
          }}>
            {s.title}
          </h2>

          {/* Subtitle */}
          <p style={{
            fontSize: '13px', color: 'var(--muted)',
            lineHeight: 1.6, marginBottom: '20px',
          }}>
            {s.subtitle}
          </p>

          {/* Bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
            {s.bullets.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', color: 'var(--text)' }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                  background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                  color: 'var(--accent)', fontSize: '11px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: '1px',
                }}>
                  {i + 1}
                </div>
                <span>{b}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {isLast ? (
              <button className="btn btn-ghost" style={{ fontSize: '12px' }} onClick={onBack}>← Back</button>
            ) : step === 0 ? (
              <button className="btn btn-ghost" style={{ fontSize: '12px' }} onClick={onSkip}>Skip tour</button>
            ) : (
              <button className="btn btn-ghost" style={{ fontSize: '12px' }} onClick={onBack}>← Back</button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{step + 1} / {ONBOARDING_STEPS.length}</span>
              {isLast ? (
                <button className="btn btn-primary" style={{ fontSize: '13px' }} onClick={onFinish}>
                  Create my first game 🎉
                </button>
              ) : (
                <button className="btn btn-primary" style={{ fontSize: '13px' }} onClick={onNext}>
                  {step === 0 ? 'Get started →' : 'Next →'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add `completeOnboarding` function inside `AdminScreen`**

Find the `const POST = useCallback(` line (around line 826) inside `AdminScreen`. Add this function directly before it:

```typescript
  async function completeOnboarding(navigateToCreate = false) {
    setShowOnboarding(false);
    await fetch('/api/admin/onboarding/complete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
    }).catch(() => {});
    if (navigateToCreate) { loadTemplates(); setView('templates'); }
  }
```

- [ ] **Step 3: Render `OnboardingModal` inside `AdminScreen`**

Find the very end of the `AdminScreen` return — somewhere just before the final `</> ` or the closing JSX. The safest place is right before the `if (view === 'branding')` block (around line 2247). Add the modal render at the top of every view by finding the first `return (` inside the main `AdminScreen` component body that wraps all views. 

The cleanest approach: find the line that contains `if (view === 'branding') return <BrandingView` (line ~2247) and add the modal render just before each `return` by instead wrapping the top-level render. 

Actually the easiest insertion point is inside the `if (view === 'games') return (` block, directly inside the fragment, before the `<nav`:

Find:
```tsx
  if (view === 'games') return (
    <>
      <nav className="nav" style={{ position: 'relative' }}>
```

Replace with:
```tsx
  if (view === 'games') return (
    <>
      {showOnboarding && (
        <OnboardingModal
          step={onboardingStep}
          onNext={() => setOnboardingStep(s => s + 1)}
          onBack={() => setOnboardingStep(s => s - 1)}
          onSkip={() => completeOnboarding(false)}
          onFinish={() => completeOnboarding(true)}
        />
      )}
      <nav className="nav" style={{ position: 'relative' }}>
```

The modal uses `position: fixed` so it overlays correctly regardless of the view content behind it.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Manual test — modal appears for new user**

In Supabase dashboard → Table Editor → `admin_branding`, set `onboarded_at = NULL` for your test user (or delete the row). Reload the admin screen. The modal should appear automatically after the branding fetch completes.

Click "Get started →" → step 2. Click "Next →" → step 3. Click "← Back" → back to step 2. Click "Next →" again → step 3. Click "Create my first game 🎉" → modal closes and view changes to templates (create game flow).

In Supabase, verify `onboarded_at` is now set on the row.

- [ ] **Step 6: Manual test — skip tour**

Set `onboarded_at = NULL` again. Reload. Click "Skip tour" (✕ button or the text button on step 0). Modal closes. `onboarded_at` is set. Reload page — modal does not reappear.

- [ ] **Step 7: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add OnboardingModal component with 3-step wizard"
```

---

## Task 6: Add "How it works" Help button to profile dropdown

**Files:**
- Modify: `components/screens/AdminScreen.tsx:1530-1562` (profile dropdown Actions section)

- [ ] **Step 1: Insert the Help button at the top of the dropdown Actions section**

Find this block (around line 1530):

```tsx
              {/* Actions */}
              <div style={{ padding: '8px' }}>
                <button
                  onClick={() => { setShowProfile(false); setView('my-analytics'); }}
```

Replace with:

```tsx
              {/* Actions */}
              <div style={{ padding: '8px' }}>
                <button
                  onClick={() => { setShowProfile(false); setOnboardingStep(0); setShowOnboarding(true); }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--text)', fontSize: '13px', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontFamily: "'Sora', sans-serif",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: '16px' }}>❓</span>
                  <span>How it works</span>
                </button>

                <button
                  onClick={() => { setShowProfile(false); setView('my-analytics'); }}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Manual test — Help reopens modal**

With `onboarded_at` already set (modal won't auto-show), open the profile dropdown and click "How it works". The modal should appear at step 0. Clicking through it and finishing should NOT change `onboarded_at` (it's already set — the upsert is idempotent but verify by checking the timestamp doesn't change significantly).

- [ ] **Step 4: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add How it works Help button to profile dropdown"
```

---

## Task 7: Push to production

- [ ] **Step 1: Verify the full build passes**

```bash
cd /Users/signevallin/Desktop/GameOn && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` with no type errors.

- [ ] **Step 2: Push to main**

```bash
git push
```

Vercel will deploy automatically. Verify the onboarding modal appears when logged in as a user with `onboarded_at = NULL`.
