# Dashboard Improvements — Design Spec

## Goal

Three targeted improvements to the admin game dashboard:

1. **Analytics under profil** — en länk i profil-dropdownen som öppnar en dedikerad statistiksida för den inloggade spelledarens egna spel
2. **Mer spacing i spelkortet** — öka gapet mellan spelkod, statusindikator och "Save as template"-knappen
3. **QR-kod till rätt sida** — ändra QR-kodens URL från `/?key=` till `/play?key=` så spelarna hamnar direkt i join-flödet

---

## Feature 1: Analytics under profil

### Vad visas

En dedikerad analytics-vy som renderas när `view === 'my-analytics'` i `AdminScreen`. Den visar spelledarens egna statistik beräknad client-side från det befintliga `games`-tillståndet.

**4 KPI-kort:**

| Label | Beräkning |
|-------|-----------|
| Spel totalt | `games.length` |
| Slutförandegrad | `games.filter(g => g.status === 'finished').length / games.length * 100`% (visas som heltal) |
| Snitt lag/spel | summan av `g.teams_count` / `games.length` (se API-ändring nedan) |
| Lag totalt | summan av `g.teams_count` för alla spel |

**Aktivitetsgraf:**
- 7 staplar = senaste 7 ISO-veckor, äldst till vänster
- Gruppering baseras på `g.started_at` (null-spel räknas ej)
- X-axel: veckonummer `"V{week}"` (t.ex. `"V24"`)
- Stapelbredd identisk — höjd proportionell mot antal
- Nuvarande vecka: full opacity (`#6ec6f5`), äldre staplar progressivt mer transparenta (formel: `0.22 + (i / (length - 1 || 1)) * 0.78`)
- Ingen Y-axel
- ISO-vecka beräknas client-side med Thursday-shift-algoritmen (samma logik som `isoWeek()` i `app/api/admin/superadmin/analytics/route.ts` — implementera som lokal hjälpfunktion i AdminScreen)

**Senaste spel:**
- Upp till 5 spel, sorterade på `started_at desc` (null längst ned)
- Varje rad: spelnamn + antal lag + "X dagar sedan" / datum

### Navigation

- Länk "📊 Analytics" läggs till i profil-dropdownen, direkt under plan-brickan (ovanför "Change password")
- Kräver att spel är laddade (`games` state) — om `games` är tomt triggas `loadGames()` automatiskt
- Bakåtknapp → `setView('games')`

### API-ändring

`GET /api/admin/game` (fetch all games) behöver lag-antal per spel för "Snitt lag/spel" och "Lag totalt".

Ändra select i `app/api/admin/game/route.ts`:

```typescript
// Från:
.select('*')

// Till:
.select('*, teams(count)')
```

Supabase returnerar `teams: [{ count: number }]`. Normalisera i API-svaret till `teams_count: number`:

```typescript
const normalized = data?.map(g => ({
  ...g,
  teams_count: (g.teams as { count: number }[] | null)?.[0]?.count ?? 0,
  teams: undefined,
})) ?? [];
```

Lägg till `teams_count: number` i frontend-typen för `Game` i `lib/supabase.ts`.

### Filer som ändras

| Fil | Ändring |
|-----|---------|
| `app/api/admin/game/route.ts` | Lägg till `teams(count)` i select, normalisera till `teams_count` |
| `lib/supabase.ts` | Lägg till `teams_count: number` i `Game`-typen |
| `components/screens/AdminScreen.tsx` | Lägg till `'my-analytics'` i `AdminView`, analytics-länk i dropdown, render-block för `view === 'my-analytics'` |

---

## Feature 2: Mer spacing i spelkortet

### Problem

På mobil (`max-width: 600px`) är gap för litet mellan spelkod, statusindikator och "Save as template"-knappen.

### Fix

I `app/globals.css`, i `@media (max-width: 600px)` blocket:

```css
/* Från: */
.admin-game-card-bottom {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

/* Till: */
.admin-game-card-bottom {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 4px 0;
}
```

Gap: `8px → 16px`. Padding `4px 0` ger lite vertikalt andrum.

### Filer som ändras

| Fil | Ändring |
|-----|---------|
| `app/globals.css` | Gap och padding på `.admin-game-card-bottom` |

---

## Feature 3: QR-kod → direkt till spelet

### Problem

QR-kodens URL pekar på `/?key=KT4X2` (landningssidan). Landningssidan hanterar inte `?key=`-parametern, så spelaren ser marknadsföringssidan och måste navigera manuellt.

### Fix

I `components/screens/AdminScreen.tsx`, ändra URL-konstruktionen för QR-koden:

```typescript
// Från:
`${window.location.origin}/?key=${activeGame.game_key}`

// Till:
`${window.location.origin}/play?key=${activeGame.game_key}`
```

`/play`-sidan + `LoginScreen` hanterar redan `?key=`-parametern och auto-fyller spelkodsfältet.

### Filer som ändras

| Fil | Ändring |
|-----|---------|
| `components/screens/AdminScreen.tsx` | QR-URL pekar på `/play?key=` |

---

## Out of Scope

- Redirect från `/?key=` till `/play?key=` för gamla QR-koder
- Analytics-data i realtid / polling
- Uppdragstatistik per spel i analytics-vyn
- Paginering i spellistan
