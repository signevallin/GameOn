# PDF Report Redesign + Mission Analytics — Design Spec

**Date:** 2026-06-05
**Status:** Approved

---

## Goal

Redesign the existing PDF report (`lib/pdf-report.tsx`) to match the GameOn landing page visual identity, remove the Score Progression page, and add a new Mission Analytics page with per-mission completion rates and score statistics.

---

## Color Palette

All pages use these tokens, replacing the previous purple-based palette:

| Token | Value | Usage |
|---|---|---|
| `bg` | `#0D1520` | Page background |
| `card` | `#162030` | Card / row backgrounds |
| `accent` | `#7CBDD4` | Headings, badges, bars, accent line |
| `gold` | `#DEBB6B` | Winner (rank 1), top scores |
| `text` | `#DCE4EE` | Primary text |
| `muted` | `#8FA8C0` | Labels, secondary text |
| `green` | `#8CBF9B` | High completion rate (≥75%) |
| `orange` | `#D4875A` | Low completion rate (<40%) |
| `row` | `#111C2A` | Alternating table row tint |

Team colors (score progression removed, but colors still used in standings):
`['#7CBDD4','#DEBB6B','#D4875A','#8CBF9B','#A68FD4','#E091B8','#6BBFA8','#A8C8D4']`

---

## Logo / Wordmark

On the cover page and in the footer, render the GameOn wordmark as two adjacent `Text` nodes inside a `View` with `flexDirection: 'row'`:

```
"Game" → color: #DCE4EE, fontFamily: Helvetica-Bold
"On"   → color: #7CBDD4, fontFamily: Helvetica-Bold
```

Font size: 28px on cover, 9px in footer.

---

## Report Pages (6 total)

### Page 1 — Cover

- Centered layout, vertically centered in the page
- Subtle radial glow: SVG `Circle` with fill `#7CBDD4` and opacity `0.10`, radius 180, behind the wordmark
- GameOn wordmark (28px, see above)
- Game name: 30px, Helvetica-Bold, `#DCE4EE`, marginTop 12
- Info card (`#162030`, borderRadius 8, padding 16×32): date (formatted "5 jun 2026"), duration in minutes, number of teams — all in `#8FA8C0`, 12px
- Footer: "Game**On**" wordmark (9px) + " · Powered by GameOn" in `#8FA8C0`

### Page 2 — Final Standings

- Heading: "FINAL STANDINGS", `#7CBDD4`, 16px Helvetica-Bold, letterSpacing 2, marginBottom 16
- Header row: columns `#` (44px), `TEAM` (flex 1), `POÄNG` (70px right), `UPPDRAG` (70px right) — all `#8FA8C0` 9px Helvetica-Bold, underlined by a 1px `#7CBDD4` line
- Data rows: alternating background (`#111C2A` / transparent), paddingVertical 9
  - Rank column: medal emoji for top 3, number otherwise
  - Team name: Helvetica-Bold for top 3, gold (`#DEBB6B`) for rank 1
  - Score: Helvetica-Bold, gold for rank 1
  - Missions: `#8FA8C0`
- Footer

### Page 3 — Mission Analytics *(new)*

- Heading: "MISSION ANALYTICS", `#7CBDD4`, 16px Helvetica-Bold, letterSpacing 2, marginBottom 4
- Subtitle: "Sorterat efter completion rate", `#8FA8C0`, 9px, marginBottom 12

**Table section:**

Header row (cyan underline): `UPPDRAG` (flex 2), `KLARADE` (55px center), `RATE` (50px center), `SNITT` (55px right), `TOPP` (55px right) — all `#8FA8C0`, 9px Helvetica-Bold.

Data rows (alternating `#111C2A` / transparent), sorted by completion rate descending:
- **Uppdrag**: icon + name, `#DCE4EE`, 10px — `{icon} {name}` concatenated as a single string (react-pdf does not support emoji reliably; use the text as-is, emoji renders as box on some systems — acceptable)
- **Klarade**: `{completed}/{teamCount}`, color-coded: green if rate ≥ 75%, cyan if ≥ 40%, orange if < 40%
- **Rate badge**: inline colored text `{rate}%` with matching color (green/cyan/orange) — react-pdf doesn't support background on inline text easily, so use bold colored text only
- **Snitt**: average score rounded to nearest integer, `#8FA8C0`
- **Topp**: highest single score for this mission across all teams, `#DEBB6B`, Helvetica-Bold

Only include missions where at least one team completed it (`completed > 0`). Skip missions with zero completions.

**Progress bars section** (below table, marginTop 14):

Label: "COMPLETION RATE" in `#8FA8C0`, 8px, letterSpacing 1.5, marginBottom 6.

For each mission (same sort order as table): a row with:
- Mission name truncated to 18 chars (60px fixed width, `#8FA8C0`, 8px)
- Bar: `View` with full width flex 1, height 5, background `#1C2D40`, borderRadius 3, containing inner `View` with width `{rate}%`, height 5, background color-coded (green/cyan/orange), borderRadius 3
- Rate label: `{rate}%` (32px right-aligned, same color as bar, 8px Helvetica-Bold)

- Footer

### Page 4 — Best Mission Per Team

- Heading: "BEST MISSION PER TEAM", `#7CBDD4`, updated palette
- Table: TEAM (flex 1), UPPDRAG (flex 2), POÄNG (60px right)
- Rows sorted by points descending, alternating row tint
- Points in `#7CBDD4`, Helvetica-Bold (was `#6c63ff`)
- Footer

### Page 5 — Fun Stats

- Heading: "FUN STATS", `#7CBDD4`, updated palette
- Three cards: `#162030` background, borderRadius 8
- Stat value text: `#7CBDD4` (was `#6c63ff`)
- Footer

### Page 6 — Photo Highlights

- Heading: "PHOTO HIGHLIGHTS", `#7CBDD4`, updated palette
- Cards: `#162030` background
- Points: `#7CBDD4` (was `#6c63ff`)
- Only rendered if photos exist — unchanged logic
- Footer

---

## Data Model Changes

### New type: `MissionStat`

```ts
export type MissionStat = {
  completed: number;   // number of teams that completed this mission
  totalScore: number;  // sum of all scores for this mission
  topScore: number;    // highest single score for this mission
};
```

### Updated `ReportData`

Add two new fields:

```ts
export type ReportData = {
  // ... existing fields ...
  teamCount: number;
  missionStats: Record<string, MissionStat>;  // keyed by mission id
};
```

### Computation in `route.ts`

After fetching `teams`, compute `missionStats` by iterating teams and their `mission_scores`:

```ts
const missionStats: Record<string, MissionStat> = {};
for (const team of teams) {
  for (const mId of (team.completed ?? [])) {
    const pts = (team.mission_scores ?? {})[mId] ?? 0;
    if (!missionStats[mId]) missionStats[mId] = { completed: 0, totalScore: 0, topScore: 0 };
    missionStats[mId].completed += 1;
    missionStats[mId].totalScore += pts;
    if (pts > missionStats[mId].topScore) missionStats[mId].topScore = pts;
  }
}
// Rate for a mission: Math.round((missionStats[mId].completed / teams.length) * 100)
// Avg score:         Math.round(missionStats[mId].totalScore / missionStats[mId].completed)
```

Pass `teamCount: teams.length` and `missionStats` in the `ReportData` object.

---

## Files Modified

| File | Change |
|---|---|
| `lib/pdf-report.tsx` | Replace color palette, update logo/wordmark, remove `ScoreChartPage`, add `MissionAnalyticsPage`, update all pages to new palette, export updated `ReportData` type |
| `app/api/admin/game/[id]/report/route.ts` | Compute `missionStats` and `teamCount`, pass to `buildReport` |

---

## Out of Scope

- Custom font (Sora) — Helvetica Bold used throughout; Sora requires self-hosting TTF files
- Per-team mission breakdown table (too verbose for a summary report)
- Timestamp-based score progression (removed by design decision)
- Storing/caching generated PDFs
