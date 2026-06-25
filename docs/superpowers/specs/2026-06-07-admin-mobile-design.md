# Admin Mobile View Design

**Date:** 2026-06-07  
**Status:** Approved

---

## Goal

Make the AdminScreen fully usable on mobile phones without breaking the existing desktop layout. Primary mobile use cases: reviewing photos, activating power-ups, watching the leaderboard, and creating new games.

## Breakpoint

`768px` — below this width the mobile layout renders. Above it, the existing desktop layout is completely unchanged.

---

## Mobile Layout

### Header

Same as desktop nav: `<GameOnLogo size={22} />` on the left, game status indicator on the right. No change needed — already renders fine on mobile.

### Bottom Navigation

Fixed bar at the bottom of the viewport with 4 tabs:

| Tab | Icon | Content |
|-----|------|---------|
| Leaderboard | 🏆 | Live standings + Start/Stop game button |
| Photos | 📸 | Pending photo submissions to rate |
| Power-ups | ⚡ | Power-up activation buttons |
| More | ··· | Progress, Stats, Analytics tabs |

Active tab indicated by a top border in `var(--accent)` and accent-colored label. Inactive tabs use `var(--muted)`.

The bottom nav is hidden on desktop (`display: none` above 768px).

### FAB (Floating Action Button)

A circular "+" button (44×44px, `var(--accent)` gradient) positioned `bottom: 72px; right: 16px` — floating above the bottom nav. Always visible regardless of active tab.

Tapping the FAB navigates to the create-game view (sets `view = 'create'`), same as the existing desktop flow. The create-game view already works reasonably on mobile — only minor padding adjustments needed.

### Desktop tabs

The existing `.admin-tabs` tab bar is hidden on mobile (`display: none` below 768px). The mobile bottom nav replaces it.

---

## Per-tab mobile adjustments

### Leaderboard tab

- Full-width leaderboard rows (already flex-based, should reflow)
- Start/Stop game button rendered below the leaderboard list
- Game key display: font size clamped with `clamp(28px, 8vw, 48px)` to prevent overflow

### Photos tab

- Photo grid: `gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))'` — single column on narrow screens
- Pending badge count shown in tab label: "Photos · 3"
- Approve/reject buttons already use `flexWrap: 'wrap'` — no change needed

### Power-ups tab

- Power-up cards are already single-column flex — should work on mobile as-is
- Minor padding reduction on mobile

### More tab

- Simple vertical list of the remaining tabs: Progress, Stats, Analytics
- Tapping one navigates to that tab's content in the main area

---

## Implementation notes

- Add a `useIsMobile()` hook (or inline `window.innerWidth < 768` state) to conditionally render bottom nav vs desktop tabs
- Use a `useEffect` + `resize` listener to update on orientation change
- The existing `tab` state and all tab content rendering stays unchanged — only the navigation chrome changes
- Mobile bottom nav maps to the same `setTab()` calls as the desktop tab buttons
- No new API routes needed

---

## Out of scope

- Tablet layout (768px–1024px uses desktop layout)
- Offline support
- Native app features (camera access, push notifications)
- The Progress tab table (many columns) — horizontal scroll inside the card is acceptable on mobile for now
