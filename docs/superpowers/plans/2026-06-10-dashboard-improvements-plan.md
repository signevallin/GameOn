# Dashboard Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tre förbättringar av admin-dashboarden: QR-URL till rätt sida, mer spacing i spelkortet, och en analytics-sida tillgänglig via profil-dropdownen.

**Architecture:** QR-fix och spacing är engångsrader. Analytics-sidan beräknas client-side från befintligt `games`-tillstånd — kräver att Games API berikas med lag-antal via Supabase-join (`teams(count)`). Ny vy `'my-analytics'` läggs till i `AdminView`-unionen i `AdminScreen.tsx`. Ingen ny API-route behövs.

**Tech Stack:** Next.js App Router, TypeScript, Supabase service-role client, React state, inline CSS (samma mönster som övriga vyer i AdminScreen).

---

### Task 1: QR-URL fix

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

- [ ] **Step 1: Ändra QR-URL till `/play?key=`**

Sök efter `/?key=${activeGame.game_key}` i `components/screens/AdminScreen.tsx` — förekommer på rad ~3210 och ~3227. Ändra **båda** förekomsterna:

```typescript
// Från:
`${typeof window !== 'undefined' ? window.location.origin : ''}/?key=${activeGame.game_key}`

// Till:
`${typeof window !== 'undefined' ? window.location.origin : ''}/play?key=${activeGame.game_key}`
```

- [ ] **Step 2: Verifiera TypeScript**

```bash
cd /Users/signevallin/Desktop/GameOn
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "fix(qr): point QR code URL to /play?key= instead of landing page"
```

---

### Task 2: Spacing-fix i spelkortet (mobil)

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Öka gap i `.admin-game-card-bottom`**

I `app/globals.css`, hitta raden i `@media (max-width: 600px)` blocket (rad ~926):

```css
/* Från: */
.admin-game-card-bottom { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }

/* Till: */
.admin-game-card-bottom { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 4px 0; }
```

Gap: `8px → 16px`. Padding `4px 0` ger lite vertikalt andrum.

- [ ] **Step 2: Verifiera TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "fix(ui): increase spacing in mobile game card bottom row"
```

---

### Task 3: Games API + Game-typ med teams_count

**Files:**
- Modify: `app/api/admin/game/route.ts`
- Modify: `lib/supabase.ts`

- [ ] **Step 1: Uppdatera GET-query att inkludera lag-antal**

I `app/api/admin/game/route.ts`, ändra GET-handlern (rad ~26–31):

```typescript
export async function GET(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin) return unauthorizedResponse();

  let query = adminClient().from('games').select('*, teams(count)').order('created_at', { ascending: false });
  if (!admin.isSuperAdmin) query = query.eq('user_id', admin.userId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const normalized = (data ?? []).map(g => ({
    ...g,
    teams_count: (g.teams as { count: number }[] | null)?.[0]?.count ?? 0,
    teams: undefined,
  }));

  return NextResponse.json({ games: normalized }, { headers: { 'Cache-Control': 'no-store, no-cache' } });
}
```

- [ ] **Step 2: Uppdatera POST action='list' på samma sätt**

I samma fil, ändra POST-blocket för `action === 'list'` (rad ~40–46):

```typescript
  if (body.action === 'list') {
    let query = adminClient().from('games').select('*, teams(count)').order('created_at', { ascending: false });
    if (!admin.isSuperAdmin) query = query.eq('user_id', admin.userId);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const normalized = (data ?? []).map(g => ({
      ...g,
      teams_count: (g.teams as { count: number }[] | null)?.[0]?.count ?? 0,
      teams: undefined,
    }));
    return NextResponse.json({ games: normalized });
  }
```

- [ ] **Step 3: Lägg till `teams_count` i Game-typen**

I `lib/supabase.ts`, lägg till fältet i `Game`-typen efter `remote_mode` (rad ~63):

```typescript
export type Game = {
  id: string;
  game_key: string;
  name: string;
  missions: string[];
  duration_minutes: number;
  status: 'draft' | 'active' | 'finished';
  started_at: string | null;
  created_at: string;
  mission_max_pts: Record<string, number>;
  hide_leaderboard?: boolean;
  ai_photo_rating?: boolean;
  ai_photo_instructions?: string | null;
  user_id?: string;
  powerups_used?: string[];
  hot_potato?: {
    mission_id: string;
    expires_at: string;
    penalty_pts: number;
    game_id: string;
  } | null;
  mystery_box?: {
    created_at: string;
    expires_at: string;
    claimed_by: string | null;
  } | null;
  remote_mode?: boolean;
  teams_count?: number;
};
```

- [ ] **Step 4: Verifiera TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/game/route.ts lib/supabase.ts
git commit -m "feat(games): include teams_count in games API response"
```

---

### Task 4: Analytics-vy i AdminScreen

**Files:**
- Modify: `components/screens/AdminScreen.tsx`

Denna task har flera ändringar i samma fil. Läs relevanta sektioner först.

- [ ] **Step 1: Lägg till `'my-analytics'` i AdminView-typen**

Hitta rad ~390 med `type AdminView`:

```typescript
// Från:
type AdminView = 'games' | 'create' | 'dashboard' | 'missions' | 'templates' | 'manage-templates' | 'analytics';

// Till:
type AdminView = 'games' | 'create' | 'dashboard' | 'missions' | 'templates' | 'manage-templates' | 'analytics' | 'my-analytics';
```

- [ ] **Step 2: Lägg till Analytics-länk i profil-dropdownen**

Hitta "Actions"-sektionen i profil-dropdownen (rad ~1241, `{/* Actions */}`). Lägg till en ny knapp **före** "Change password"-knappen:

```typescript
              {/* Actions */}
              <div style={{ padding: '8px' }}>
                <button
                  onClick={() => { setShowProfile(false); setView('my-analytics'); }}
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
                  <span style={{ fontSize: '16px' }}>📊</span>
                  <span>Analytics</span>
                </button>

                <button
                  onClick={() => { handleChangePassword(); }}
                  // ... (befintlig Change password-knapp, oförändrad)
```

- [ ] **Step 3: Lägg till render-blocket för `view === 'my-analytics'`**

Hitta raden `// ── ANALYTICS PAGE (super admin only) ──` (rad ~1321). Lägg till följande **precis efter** det befintliga `if (view === 'analytics' && isSuperAdmin) { ... }`-blocket (dvs. efter dess avslutande `}`), men **före** games-list-blocket:

```typescript
  // ── MY ANALYTICS (per-user) ──
  if (view === 'my-analytics') {
    function isoWeekKey(d: Date): string {
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
      const y = tmp.getUTCFullYear();
      const yearStart = new Date(Date.UTC(y, 0, 1));
      const w = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      return `${y}-${w}`;
    }

    function timeAgo(dateStr: string): string {
      const diff = Date.now() - new Date(dateStr).getTime();
      const days = Math.floor(diff / 86400000);
      if (days === 0) return 'idag';
      if (days === 1) return '1 dag sedan';
      if (days < 7) return `${days} dagar sedan`;
      const weeks = Math.floor(days / 7);
      if (weeks === 1) return '1 vecka sedan';
      return `${weeks} veckor sedan`;
    }

    const totalGames = games.length;
    const finishedCount = games.filter(g => g.status === 'finished').length;
    const completionRate = totalGames > 0 ? Math.round(finishedCount / totalGames * 100) : 0;
    const totalTeams = games.reduce((sum, g) => sum + (g.teams_count ?? 0), 0);
    const avgTeams = totalGames > 0 ? (totalTeams / totalGames).toFixed(1) : '—';

    // Last 7 ISO weeks oldest → newest
    const gamesPerWeek: { label: string; key: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i * 7);
      const key = isoWeekKey(d);
      const weekNum = parseInt(key.split('-')[1]);
      gamesPerWeek.push({ label: `V${weekNum}`, key, count: 0 });
    }
    games.forEach(g => {
      if (!g.started_at) return;
      const key = isoWeekKey(new Date(g.started_at));
      const entry = gamesPerWeek.find(e => e.key === key);
      if (entry) entry.count++;
    });
    const maxCount = Math.max(...gamesPerWeek.map(w => w.count), 1);

    // Last 5 started games
    const recentGames = [...games]
      .filter(g => g.started_at)
      .sort((a, b) => new Date(b.started_at!).getTime() - new Date(a.started_at!).getTime())
      .slice(0, 5);

    const kpis = [
      { label: 'Spel totalt', value: String(totalGames), color: 'var(--accent)' },
      { label: 'Slutförandegrad', value: `${completionRate}%`, color: 'var(--accent3)' },
      { label: 'Snitt lag/spel', value: String(avgTeams), color: 'var(--text)' },
      { label: 'Lag totalt', value: String(totalTeams), color: 'var(--gold)' },
    ];

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '20px 16px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button
              onClick={() => setView('games')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--accent)', fontSize: 13, padding: '6px 0',
                fontFamily: "'Sora', sans-serif",
              }}
            >
              ← Tillbaka
            </button>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text)' }}>
              📊 Din statistik
            </h1>
          </div>

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {kpis.map(kpi => (
              <div
                key={kpi.label}
                style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '14px 12px', textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Chart + Recent games */}
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 12 }}>
            {/* Activity bar chart */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                Spel per vecka
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
                {gamesPerWeek.map((w, i) => {
                  const opacity = 0.22 + (i / (gamesPerWeek.length - 1 || 1)) * 0.78;
                  const heightPx = w.count === 0 ? 4 : Math.max(8, Math.round((w.count / maxCount) * 80));
                  return (
                    <div
                      key={w.key}
                      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                    >
                      <div
                        style={{
                          width: '100%',
                          background: `rgba(110,198,245,${opacity})`,
                          borderRadius: '3px 3px 0 0',
                          height: heightPx,
                        }}
                      />
                      <div style={{ fontSize: 9, color: 'var(--muted)' }}>{w.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent games */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                Senaste spel
              </div>
              {recentGames.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>Inga spel ännu</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {recentGames.map(g => (
                    <div key={g.id}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: 'var(--text)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {g.name || '(namnlöst)'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {g.teams_count ?? 0} lag · {g.started_at ? timeAgo(g.started_at) : 'Utkast'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
```

- [ ] **Step 4: Verifiera TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add components/screens/AdminScreen.tsx
git commit -m "feat(analytics): personal analytics view accessible from profile dropdown"
```

---

### Task 5: Slutlig check + push

**Files:**
- No new files

- [ ] **Step 1: Full TypeScript-check**

```bash
cd /Users/signevallin/Desktop/GameOn
npx tsc --noEmit 2>&1
```

Expected: ingen output (noll fel).

- [ ] **Step 2: Build-check**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Push**

```bash
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ QR-URL → `/play?key=` (Task 1)
- ✅ Spacing i mobilkortet: gap `8px → 16px` + `padding: 4px 0` (Task 2)
- ✅ `teams_count` i Games API (Task 3)
- ✅ `teams_count` i Game-typen (Task 3)
- ✅ `'my-analytics'` i AdminView (Task 4)
- ✅ Analytics-länk i profil-dropdownen (Task 4)
- ✅ 4 KPI-kort (spel totalt, slutförandegrad, snitt lag/spel, lag totalt) (Task 4)
- ✅ Aktivitetsgraf 7 veckor med opacity-ramp (Task 4)
- ✅ Senaste 5 spel med lag-antal och tidsangivelse (Task 4)
- ✅ Bakåtknapp → `setView('games')` (Task 4)

**Placeholder-scan:** Inga TBD, inga "implement here". All kod är komplett.

**Type consistency:**
- `teams_count?: number` definieras i Task 3 (lib/supabase.ts) och används som `g.teams_count ?? 0` i Task 4 — konsekvent.
- `isoWeekKey` definieras och används lokalt i `view === 'my-analytics'`-blocket — inga externa beroenden.
- `AdminView` utökas med `'my-analytics'` i Task 4 Step 1 — används i `setView('my-analytics')` i Step 2 — konsekvent.
