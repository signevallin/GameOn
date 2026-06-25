# Admin Mobile View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AdminScreen fully usable on mobile phones with a bottom navigation bar, FAB for game creation, and responsive content fixes — without changing the desktop layout.

**Architecture:** A `useIsMobile` hook detects viewport width. Below 768px the desktop `.admin-tabs` bar is hidden (CSS) and a fixed bottom nav renders instead. A floating "+" FAB always triggers the create-game flow. Content layout fixes (grid columns, font sizes) are applied via CSS media queries and inline style adjustments. All existing desktop behaviour is completely unchanged.

**Tech Stack:** React hooks, CSS media queries, TypeScript, Next.js App Router

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `hooks/useIsMobile.ts` | Create | Returns `true` when viewport < 768px, updates on resize |
| `app/globals.css` | Modify | Hide desktop tabs on mobile, bottom nav + FAB styles, responsive layout fixes |
| `components/screens/AdminScreen.tsx` | Modify | Import hook, add bottom nav JSX, add FAB, add more-sheet, content fixes |

---

### Task 1: `useIsMobile` hook

**Files:**
- Create: `hooks/useIsMobile.ts`

No test framework — verify with TypeScript check.

- [ ] **Step 1: Create the hook**

```typescript
// hooks/useIsMobile.ts
'use client';
import { useState, useEffect } from 'react';

/**
 * Returns true when the viewport width is below the given breakpoint.
 * Defaults to false on the server (SSR-safe).
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);

  return isMobile;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep -E "useIsMobile|error TS" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add hooks/useIsMobile.ts
git commit -m "feat: add useIsMobile hook"
```

---

### Task 2: Mobile CSS in globals.css

**Files:**
- Modify: `app/globals.css`

Add all mobile styles after the existing `.admin-tab.active` rule (around line 641). Do not change any existing rules.

- [ ] **Step 1: Add mobile CSS after line 641**

Find this line in `app/globals.css`:
```css
.admin-tab.active { background: var(--accent); color: #0a0e19; }
```

Add the following immediately after it:

```css

/* ── MOBILE ADMIN (< 768px) ── */
@media (max-width: 767px) {
  /* Hide desktop tab bar */
  .admin-tabs { display: none; }

  /* Add bottom padding so content isn't hidden behind bottom nav */
  .container { padding-bottom: 80px; }

  /* Fixed bottom navigation */
  .mobile-bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: stretch;
    z-index: 100;
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }

  .mobile-bottom-nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    position: relative;
  }

  .mobile-bottom-nav-item .mobile-nav-icon {
    font-size: 20px;
    line-height: 1;
  }

  .mobile-bottom-nav-item .mobile-nav-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--muted);
    font-family: 'Sora', sans-serif;
  }

  .mobile-bottom-nav-item.active .mobile-nav-label {
    color: var(--accent);
  }

  .mobile-bottom-nav-item.active::before {
    content: '';
    position: absolute;
    top: 0;
    left: 20%;
    right: 20%;
    height: 2px;
    background: var(--accent);
    border-radius: 0 0 2px 2px;
  }

  /* Floating action button */
  .mobile-fab {
    position: fixed;
    bottom: 72px;
    right: 16px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), #5aa3bd);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    font-weight: 700;
    color: #0a0e19;
    box-shadow: 0 4px 16px rgba(124, 189, 212, 0.45);
    z-index: 101;
    line-height: 1;
  }

  /* More sheet overlay */
  .mobile-more-sheet {
    position: fixed;
    bottom: 60px;
    left: 0;
    right: 0;
    background: var(--surface);
    border-top: 1px solid var(--border);
    border-radius: 16px 16px 0 0;
    padding: 16px;
    z-index: 99;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .mobile-more-sheet-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    width: 100%;
    text-align: left;
    font-family: 'Sora', sans-serif;
  }

  /* Game key font size — prevent overflow on narrow screens */
  .mobile-game-key {
    font-family: 'Sora', sans-serif;
    font-size: clamp(28px, 8vw, 48px);
    font-weight: 700;
    color: var(--accent);
    letter-spacing: clamp(3px, 1.5vw, 8px);
    line-height: 1;
  }

  /* Photo grid — single column on phones */
  .mobile-photo-grid {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)) !important;
  }

  /* KPI cards — 2 columns on mobile instead of 4 */
  .mobile-kpi-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }

  /* Analytics 2-col — stack to 1 col on mobile */
  .mobile-analytics-grid {
    grid-template-columns: 1fr !important;
  }

  /* Nav bar — hide text on ghost buttons to save space */
  .mobile-nav-text-hide {
    display: none;
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/signevallin/Desktop/GameOn && npm run build 2>&1 | tail -10
```

Expected: build succeeds with no CSS errors.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add mobile admin CSS (bottom nav, FAB, responsive fixes)"
```

---

### Task 3: Mobile bottom nav, FAB, and more-sheet in AdminScreen

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

This task adds the mobile UI chrome — bottom nav, FAB, and more sheet — to the dashboard view. It does not change any tab content.

- [ ] **Step 1: Import `useIsMobile` and add `mobileMoreOpen` state**

Find the import block at the top of AdminScreen.tsx. Add the import:

```typescript
import { useIsMobile } from '@/hooks/useIsMobile';
```

Find this line (around line 376):
```typescript
  const [tab, setTab] = useState<'leaderboard' | 'progress' | 'photos' | 'powerups' | 'stats' | 'customers'>('leaderboard');
```

Add directly after it:
```typescript
  const isMobile = useIsMobile();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
```

- [ ] **Step 2: Add mobile bottom nav + FAB + more-sheet JSX**

The dashboard view `return (...)` starts around line 1498. Find the closing `</>` of the dashboard return (the very last `</>` before the final `);` of the component, around line 2188). Insert the following **before** that closing `</>`:

```tsx
      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <>
          {/* More sheet overlay */}
          {mobileMoreOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                onClick={() => setMobileMoreOpen(false)}
              />
              <div className="mobile-more-sheet">
                <button
                  className="mobile-more-sheet-item"
                  onClick={() => { setTab('progress'); setMobileMoreOpen(false); }}
                >
                  📊 Progress
                </button>
                <button
                  className="mobile-more-sheet-item"
                  onClick={() => { setTab('stats'); setMobileMoreOpen(false); }}
                >
                  📈 Stats
                </button>
                {isSuperAdmin && (
                  <button
                    className="mobile-more-sheet-item"
                    onClick={() => { setTab('customers'); loadAnalytics(); setMobileMoreOpen(false); }}
                  >
                    📊 Analytics
                  </button>
                )}
              </div>
            </>
          )}

          {/* FAB — create new game */}
          <button
            className="mobile-fab"
            onClick={() => setView('create')}
            aria-label="Create new game"
          >
            +
          </button>

          {/* Bottom navigation */}
          <nav className="mobile-bottom-nav">
            <button
              className={`mobile-bottom-nav-item${tab === 'leaderboard' ? ' active' : ''}`}
              onClick={() => { setTab('leaderboard'); setMobileMoreOpen(false); }}
            >
              <span className="mobile-nav-icon">🏆</span>
              <span className="mobile-nav-label">Leaderboard</span>
            </button>
            <button
              className={`mobile-bottom-nav-item${tab === 'photos' ? ' active' : ''}`}
              onClick={() => { setTab('photos'); setMobileMoreOpen(false); }}
              style={{ position: 'relative' }}
            >
              <span className="mobile-nav-icon">📸</span>
              <span className="mobile-nav-label">
                Photos{totalPendingPhotos > 0 ? ` · ${totalPendingPhotos}` : ''}
              </span>
            </button>
            <button
              className={`mobile-bottom-nav-item${tab === 'powerups' ? ' active' : ''}`}
              onClick={() => { setTab('powerups'); setMobileMoreOpen(false); }}
            >
              <span className="mobile-nav-icon">⚡</span>
              <span className="mobile-nav-label">Power-ups</span>
            </button>
            <button
              className={`mobile-bottom-nav-item${mobileMoreOpen ? ' active' : ''}`}
              onClick={() => setMobileMoreOpen(o => !o)}
            >
              <span className="mobile-nav-icon" style={{ letterSpacing: '-2px' }}>···</span>
              <span className="mobile-nav-label">More</span>
            </button>
          </nav>
        </>
      )}
```

- [ ] **Step 3: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep -E "AdminScreen|useIsMobile|error TS" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add mobile bottom nav, FAB, and more-sheet to AdminScreen"
```

---

### Task 4: Mobile content layout fixes in AdminScreen

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

Apply CSS class additions and inline style fixes to make tab content readable on mobile.

- [ ] **Step 1: Fix game key font size**

Find (around line 1574):
```tsx
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '48px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '8px', lineHeight: 1 }}>
                {activeGame.game_key}
              </div>
```

Replace with:
```tsx
              <div className="mobile-game-key" style={{ fontFamily: "'Sora', sans-serif", fontSize: '48px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '8px', lineHeight: 1 }}>
                {activeGame.game_key}
              </div>
```

(The CSS class overrides font-size and letterSpacing on mobile only; desktop style prop remains unchanged.)

- [ ] **Step 2: Fix pending photos grid**

Find (around line 1804) the pending photos grid container. It has this inline style:
```tsx
gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'
```

Add `mobile-photo-grid` class to that div. Find the div that contains this gridTemplateColumns and add the className. It looks like:
```tsx
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
```

Replace with:
```tsx
<div className="mobile-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
```

- [ ] **Step 3: Fix rated photos grid**

Find the rated photos grid (around line 1903) with:
```tsx
gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))'
```

Add `mobile-photo-grid` class to that div as well:
```tsx
<div className="mobile-photo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
```

- [ ] **Step 4: Fix KPI cards grid (Stats/Analytics tabs)**

Find the KPI grid in the analytics section (around line 2183) with:
```tsx
gridTemplateColumns: 'repeat(4, 1fr)'
```

Add `mobile-kpi-grid` class:
```tsx
<div className="mobile-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
```

- [ ] **Step 5: Fix analytics two-column grid**

Find the two-column analytics layout (around line 2202) with:
```tsx
gridTemplateColumns: '1fr 1fr'
```

Add `mobile-analytics-grid` class:
```tsx
<div className="mobile-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/signevallin/Desktop/GameOn && npx tsc --noEmit 2>&1 | grep "error TS" | head -10
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: mobile content layout fixes (game key, photo grids, KPI cards)"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|-----------------|------|
| Breakpoint 768px | Task 2 CSS |
| Bottom nav: Leaderboard, Photos, Power-ups, More | Task 3 |
| FAB "+" opens create-game | Task 3 |
| Active tab: top border + accent label | Task 2 CSS `.mobile-bottom-nav-item.active` |
| "More" tab: Progress, Stats, Analytics | Task 3 more-sheet |
| isSuperAdmin: Analytics in More sheet | Task 3 |
| Photos pending count in tab label | Task 3 |
| Game key: clamped font size | Task 4 Step 1 |
| Photo grids: responsive columns | Task 4 Steps 2–3 |
| GameOnLogo in header | Already used — nav unchanged |
| All text in English | All labels in Task 3 are English |
| Desktop layout unchanged | CSS only applies below 767px, no desktop code touched |
| Stop/Start game in Leaderboard tab | Already there — no change needed |

**Placeholder scan:** None found.

**Type consistency:** `useIsMobile` returns `boolean`, used as `isMobile` throughout. `mobileMoreOpen` is `boolean`. No new types introduced.
