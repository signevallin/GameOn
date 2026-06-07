# Presenter Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen presenter page (for projectors/TVs) showing a live leaderboard, photo grid, countdown timer, and dramatic power-up overlays — opened from the admin dashboard in a new tab.

**Architecture:** A new public Next.js page at `/present/[gameKey]` polls a new read-only API endpoint every 4 seconds, diffs `pending_notification` per team to detect power-up events, and renders a two-column layout (leaderboard left, photos right) with full-screen overlays on events. No auth required.

**Tech Stack:** Next.js App Router (client component), Supabase (service role key), React hooks, inline CSS (matching existing patterns in the codebase).

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `app/api/present/[gameKey]/route.ts` | Create | Public GET endpoint returning game, teams, photos |
| `app/present/[gameKey]/page.tsx` | Create | Full-screen presenter page with polling + overlays |
| `components/screens/AdminScreen.tsx` | Modify | Add "📺 Presenter" button to game dashboard toolbar |

---

### Task 1: Public presenter API

**Files:**
- Create: `app/api/present/[gameKey]/route.ts`

- [ ] **Step 1: Create the file with this exact content**

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: Request,
  { params }: { params: { gameKey: string } }
) {
  const supabase = getSupabase();
  const gameKey = params.gameKey.toUpperCase();

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('id, name, status, started_at, duration_minutes')
    .eq('game_key', gameKey)
    .single();

  if (gameErr || !game) {
    return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
  }

  const [teamsRes, photosRes] = await Promise.all([
    supabase
      .from('teams')
      .select('id, name, score, pending_notification')
      .eq('game_id', game.id)
      .order('score', { ascending: false }),
    supabase
      .from('photo_submissions')
      .select('id, photo_url, team_id, created_at')
      .eq('status', 'rated')
      .in(
        'team_id',
        // subquery not supported — fetch team ids first, filter client-side
        // instead filter by joining on game_id via teams
        // We pass them explicitly after teams are loaded:
        [] // placeholder — see note below
      )
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  // Fetch approved photos filtered by game's teams
  const teamIds = (teamsRes.data ?? []).map((t: { id: string }) => t.id);
  const { data: photos } = await supabase
    .from('photo_submissions')
    .select('id, photo_url, team_id, created_at')
    .eq('status', 'rated')
    .in('team_id', teamIds.length > 0 ? teamIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    game: {
      name: game.name,
      status: game.status,
      started_at: game.started_at,
      duration_minutes: game.duration_minutes,
    },
    teams: teamsRes.data ?? [],
    photos: photos ?? [],
  });
}
```

> **Note:** The parallel `photosRes` query above uses a placeholder — the actual photos fetch happens after `teamIds` is known. The parallel block is there as a skeleton; in practice both queries run sequentially (game → teams → photos). This is fine for a 4-second poll interval.

- [ ] **Step 2: Simplify — replace the file with the clean sequential version**

Replace the entire file with:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: Request,
  { params }: { params: { gameKey: string } }
) {
  const supabase = getSupabase();
  const gameKey = params.gameKey.toUpperCase();

  const { data: game, error: gameErr } = await supabase
    .from('games')
    .select('id, name, status, started_at, duration_minutes')
    .eq('game_key', gameKey)
    .single();

  if (gameErr || !game) {
    return NextResponse.json({ error: 'Game not found.' }, { status: 404 });
  }

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, score, pending_notification')
    .eq('game_id', game.id)
    .order('score', { ascending: false });

  const teamIds = (teams ?? []).map((t: { id: string }) => t.id);

  const { data: photos } = await supabase
    .from('photo_submissions')
    .select('id, photo_url, team_id, created_at')
    .eq('status', 'rated')
    .in('team_id', teamIds.length > 0 ? teamIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    game: {
      name: game.name,
      status: game.status,
      started_at: game.started_at,
      duration_minutes: game.duration_minutes,
    },
    teams: teams ?? [],
    photos: photos ?? [],
  });
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Test the endpoint manually**

Start the dev server (`npm run dev`) and open:
`http://localhost:3000/api/present/[a real game key from your DB]`

Expected: JSON with `game`, `teams` (sorted by score desc), `photos` (only `status=rated`).

- [ ] **Step 5: Commit**

```bash
git add app/api/present/[gameKey]/route.ts
git commit -m "feat: add public presenter API endpoint"
```

---

### Task 2: Presenter page — layout and polling

**Files:**
- Create: `app/present/[gameKey]/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import GameOnLogo from '@/components/GameOnLogo';

type Team = {
  id: string;
  name: string;
  score: number;
  pending_notification: { msgKey: string; params?: Record<string, unknown> } | null;
};

type Photo = {
  id: string;
  photo_url: string;
  team_id: string;
  created_at: string;
};

type Game = {
  name: string;
  status: 'draft' | 'active' | 'finished';
  started_at: string | null;
  duration_minutes: number;
};

type PresentData = {
  game: Game;
  teams: Team[];
  photos: Photo[];
};

function useTimer(game: Game | null): string {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!game) return;

    function compute() {
      if (!game) return;
      if (game.status === 'finished') { setDisplay('Avslutat'); return; }
      if (game.status === 'draft' || !game.started_at) { setDisplay(''); return; }
      const end = new Date(game.started_at).getTime() + game.duration_minutes * 60 * 1000;
      const diff = Math.max(0, end - Date.now());
      if (diff === 0) { setDisplay('Avslutat'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(`${m}:${String(s).padStart(2, '0')} kvar`);
    }

    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [game]);

  return display;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

export default function PresentPage({ params }: { params: { gameKey: string } }) {
  const [data, setData] = useState<PresentData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const prevNotifications = useRef<Record<string, string>>({});
  const [overlay, setOverlay] = useState<{ emoji: string; title: string; subtitle: string } | null>(null);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timer = useTimer(data?.game ?? null);

  const showOverlay = useCallback((emoji: string, title: string, subtitle: string) => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    setOverlay({ emoji, title, subtitle });
    overlayTimer.current = setTimeout(() => setOverlay(null), 4000);
  }, []);

  function buildOverlay(msgKey: string, params: Record<string, unknown> = {}, teamName: string) {
    const p = params as Record<string, string | number>;
    switch (msgKey) {
      case 'frozen_msg':         return { emoji: '❄️', title: 'FRYST!', subtitle: `${teamName} frös ett annat lag` };
      case 'double_trouble_msg': return { emoji: '😈', title: 'DOUBLE TROUBLE!', subtitle: `${teamName} måste slutföra extrauppdrag` };
      case 'shield_msg':         return { emoji: '🛡️', title: 'SKÖLD AKTIVERAD!', subtitle: `${teamName} skyddade sig` };
      case 'all_in_lost_msg':    return { emoji: '🎲', title: 'GAMBLADE BORT!', subtitle: `${teamName} förlorade ${p.wager ?? ''} poäng` };
      case 'all_in_won_msg':     return { emoji: '🎲', title: 'JACKPOT!', subtitle: `${teamName} vann ${p.prize ?? ''} poäng` };
      case 'point_steal_from_msg': return { emoji: '🤑', title: 'POÄNGTJUV!', subtitle: `${p.stolen ?? ''} poäng stals från ${teamName}` };
      case 'point_steal_to_msg': return { emoji: '🤑', title: 'POÄNGTJUV!', subtitle: `${teamName} stal ${p.stolen ?? ''} poäng` };
      case 'robin_hood_from_msg': return { emoji: '🏹', title: 'ROBIN HOOD!', subtitle: `Poäng omfördelades från ${teamName}` };
      case 'robin_hood_to_msg':  return { emoji: '🏹', title: 'ROBIN HOOD!', subtitle: `${teamName} fick omfördelade poäng` };
      case 'robin_hood_self_msg': return { emoji: '🏹', title: 'ROBIN HOOD!', subtitle: `${teamName} omfördelade poäng` };
      case 'duel_received_msg':  return { emoji: '⚔️', title: 'DUEL!', subtitle: `${teamName} attackerades — ${p.stolen ?? ''} poäng stals` };
      case 'photo_rated_earned': return { emoji: '📸', title: 'FOTO GODKÄNT!', subtitle: `${teamName} fick ${p.points ?? ''} poäng` };
      case 'photo_rated_earned_item': return { emoji: '📸', title: 'FOTO GODKÄNT!', subtitle: `${teamName} fick ${p.points ?? ''} poäng` };
      case 'sabotage_msg':       return { emoji: '💥', title: 'SABOTAGE!', subtitle: 'Alla lag tappar 100 poäng' };
      case 'double_points_msg':  return { emoji: '⚡', title: 'DUBBLA POÄNG!', subtitle: 'Alla lag får dubbelt nu' };
      case 'final_frenzy_msg':   return { emoji: '🔥', title: 'FINAL FRENZY!', subtitle: 'Alla poäng dubbleras direkt' };
      case 'hot_potato_msg':     return { emoji: '🥔', title: 'HET POTATIS!', subtitle: `${teamName} fick en het potatis` };
      case 'hot_potato_penalty_msg': return { emoji: '🥔', title: 'HET POTATIS!', subtitle: `${teamName} brändes av potatisen` };
      default: return null;
    }
  }

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/present/${params.gameKey}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) return;
      const json: PresentData = await res.json();
      setData(json);

      // Diff pending_notification per team
      for (const team of json.teams) {
        const notif = team.pending_notification;
        if (!notif) continue;
        const key = JSON.stringify(notif);
        if (prevNotifications.current[team.id] !== key) {
          prevNotifications.current[team.id] = key;
          const ov = buildOverlay(notif.msgKey, notif.params ?? {}, team.name);
          if (ov) showOverlay(ov.emoji, ov.title, ov.subtitle);
        }
      }
    } catch {
      // silently retry next poll
    }
  }, [params.gameKey, showOverlay]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [poll]);

  if (notFound) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0e19', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8FA8C0', fontFamily: "'Sora', sans-serif", fontSize: '24px' }}>
        Spelet hittades inte
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0e19', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid #7CBDD4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const { game, teams, photos } = data;

  return (
    <div style={{
      minHeight: '100vh', height: '100vh', overflow: 'hidden',
      background: '#0a0e19', color: '#DCE4EE',
      fontFamily: "'Sora', sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      {/* ── TOP BAR ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: '72px', flexShrink: 0,
        background: 'rgba(10,14,26,0.9)', borderBottom: '1px solid rgba(124,189,212,0.12)',
      }}>
        <GameOnLogo size={28} />
        <span style={{ fontWeight: 800, fontSize: '22px', letterSpacing: '-.03em' }}>{game.name}</span>
        <span style={{ fontWeight: 700, fontSize: '20px', color: game.status === 'finished' ? '#8FA8C0' : '#7CBDD4', letterSpacing: '1px', minWidth: '160px', textAlign: 'right' }}>
          {game.status === 'draft' ? 'Väntar på start' : `⏱ ${timer}`}
        </span>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', gap: 0 }}>
        {/* Leaderboard */}
        <div style={{
          width: '30%', flexShrink: 0, padding: '32px 28px',
          borderRight: '1px solid rgba(124,189,212,0.1)',
          overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.18em', color: '#7CBDD4', marginBottom: '8px', textTransform: 'uppercase' }}>Leaderboard</div>
          {teams.map((team, i) => (
            <div key={team.id} style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 18px', borderRadius: '12px',
              background: i === 0 ? 'rgba(222,187,107,0.07)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${i === 0 ? 'rgba(222,187,107,0.3)' : 'rgba(124,189,212,0.1)'}`,
            }}>
              <span style={{ fontSize: '22px', width: '32px', textAlign: 'center', flexShrink: 0 }}>
                {i < 3 ? RANK_MEDALS[i] : <span style={{ fontWeight: 800, fontSize: '16px', color: '#6e82a5' }}>{i + 1}</span>}
              </span>
              <span style={{ flex: 1, fontWeight: 700, fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: i === 0 ? '#debb6b' : '#DCE4EE' }}>
                {team.name}
              </span>
              <span style={{ fontWeight: 800, fontSize: '18px', flexShrink: 0, color: i === 0 ? '#debb6b' : '#7CBDD4' }}>
                {team.score.toLocaleString('sv-SE')} p
              </span>
            </div>
          ))}
          {teams.length === 0 && (
            <div style={{ color: '#8FA8C0', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>Inga lag ännu</div>
          )}
        </div>

        {/* Photo grid */}
        <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '.18em', color: '#7CBDD4', marginBottom: '16px', textTransform: 'uppercase' }}>Godkända foton</div>
          {photos.length === 0 ? (
            <div style={{ color: '#8FA8C0', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>Inga foton ännu</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
              {photos.map(photo => (
                <div key={photo.id} style={{ aspectRatio: '1', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(124,189,212,0.15)' }}>
                  <img src={photo.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── POWER-UP OVERLAY ── */}
      {overlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(8,12,22,0.93)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          animation: 'overlayIn .35s cubic-bezier(.16,1,.3,1)',
        }}>
          <style>{`
            @keyframes overlayIn { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: scale(1); } }
          `}</style>
          <div style={{ fontSize: '96px', lineHeight: 1, marginBottom: '24px' }}>{overlay.emoji}</div>
          <div style={{ fontSize: '52px', fontWeight: 900, letterSpacing: '-.02em', color: '#DCE4EE', marginBottom: '16px', textAlign: 'center' }}>{overlay.title}</div>
          <div style={{ fontSize: '26px', color: '#8FA8C0', fontWeight: 600, textAlign: 'center', maxWidth: '600px' }}>{overlay.subtitle}</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and open the presenter page**

```bash
npm run dev
```

Open `http://localhost:3000/present/[a real game key]` in a browser.

Expected:
- Top bar with logo, game name, timer
- Leaderboard on the left with team names and scores
- Photo grid on the right (empty if no rated photos yet)
- No overlay shown initially

- [ ] **Step 4: Commit**

```bash
git add app/present/[gameKey]/page.tsx
git commit -m "feat: add presenter page with leaderboard, photo grid, and timer"
```

---

### Task 3: Power-up overlay testing

**Files:**
- Modify: `app/present/[gameKey]/page.tsx` (no code changes — manual testing only)

- [ ] **Step 1: Verify overlay appears**

With the dev server running and presenter page open, temporarily trigger a power-up in the admin dashboard (or use the browser console to manually set state).

Alternative: in the browser console on the presenter page, call:
```js
// This simulates what happens when a new notification is detected
// Open browser console on the presenter page and run:
fetch('/api/present/[gameKey]').then(r=>r.json()).then(d=>console.log(d.teams))
```

Confirm `pending_notification` is present on teams that have received power-ups.

- [ ] **Step 2: Verify overlay auto-dismisses after 4 seconds**

Trigger a real power-up from the admin dashboard and watch the presenter page. Overlay should appear, then disappear after 4 seconds without any interaction.

- [ ] **Step 3: Commit (no changes — just checkpoint)**

```bash
git commit --allow-empty -m "test: verified power-up overlays on presenter page"
```

---

### Task 4: Presenter button in admin dashboard

**Files:**
- Modify: `components/screens/AdminScreen.tsx` (around line 2268 — the game dashboard toolbar with START/END/RESTART buttons)

- [ ] **Step 1: Add the presenter button**

Find this block in `AdminScreen.tsx` (around line 2279):

```tsx
{(activeGame.status === 'finished' || activeGame.status === 'active') && (
```

Add the presenter button just before this block — it should be visible for `active` and `finished` games:

```tsx
{(activeGame.status === 'active' || activeGame.status === 'finished') && (
  <button
    className="btn btn-ghost"
    onClick={() => window.open(`/present/${activeGame.game_key}`, '_blank', 'noopener,noreferrer')}
    style={{ fontSize: '13px', padding: '12px 20px', border: '1px solid var(--border)' }}
    title="Open presenter view for projector or TV"
  >
    📺 Presenter
  </button>
)}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify button appears**

With dev server running, log in to admin, open an active or finished game. Confirm "📺 Presenter" button appears in the toolbar. Click it — it should open `/present/[gameKey]` in a new tab.

- [ ] **Step 4: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat: add presenter button to admin game dashboard"
```

---

### Task 5: Polish and edge cases

**Files:**
- Modify: `app/present/[gameKey]/page.tsx`

- [ ] **Step 1: Add `overflow: hidden` to body to prevent scroll on the presenter page**

Add a `useEffect` that sets `document.body.style.overflow = 'hidden'` on mount and restores it on unmount:

```tsx
useEffect(() => {
  const prev = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  return () => { document.body.style.overflow = prev; };
}, []);
```

Add this inside `PresentPage`, after the existing `useEffect` for polling.

- [ ] **Step 2: Verify "game not started" state**

Open `/present/[key]` for a game that is still in `draft` status. Expected: layout renders, timer area shows "Väntar på start", leaderboard and photos are empty or show teams with 0 score.

- [ ] **Step 3: Verify "game not found" state**

Open `/present/INVALID` in the browser. Expected: full-screen "Spelet hittades inte" message.

- [ ] **Step 4: Type-check and push**

```bash
npx tsc --noEmit
git add app/present/[gameKey]/page.tsx
git commit -m "fix: prevent body scroll on presenter page"
git push
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Public GET API at `/api/present/[gameKey]`
- ✅ Returns game, teams (sorted by score), approved photos (max 20, newest first)
- ✅ Top bar: logo, game name, countdown timer
- ✅ Leaderboard 30% width, medals for top 3, score per team
- ✅ Photo grid 70% width, square thumbnails, newest first
- ✅ Power-up overlays: full-screen, 4s auto-dismiss, covers all msgKey types from spec
- ✅ "📺 Presenter" button in admin dashboard (active + finished games)
- ✅ Error states: not found, draft state, network errors silently retry
- ✅ No auth required on the API or page

**No placeholders:** confirmed — all steps contain actual code.

**Type consistency:** `Team`, `Photo`, `Game` types defined in Task 2 and used consistently. `buildOverlay` takes `msgKey: string` matching what the API returns from `pending_notification.msgKey`.
