# PDF Results Report – Design Spec
_Date: 2026-05-29_

## Background

After a game ends, admins want a downloadable PDF summary to share with participants. The report includes final standings, a score progression chart, per-team highlights, fun stats, and the best photo from each team.

---

## Trigger

- **Auto:** The "Download Report" button appears in the admin dashboard automatically when `game.status === 'finished'`. No pre-generation or storage — the PDF is generated on demand.
- **On demand:** Admin clicks "📄 Ladda ner rapport" → browser receives the PDF file directly (~2–4 seconds).

---

## API Route

### `GET /api/admin/game/[id]/report`

Requires `Authorization: Bearer <token>` (same pattern as other admin routes).

**Steps:**
1. Validate admin token; verify the game belongs to the requesting user (or isSuperAdmin).
2. Fetch game row from `games`.
3. Fetch all teams for the game, sorted by `score DESC`, then `finished_at ASC` (fastest finisher wins ties).
4. Fetch `photo_submissions` for all teams in this game where `status = 'rated'` and `points_awarded > 0`.
5. Select the **single highest-scoring photo per team** (max `points_awarded`).
6. Fetch each selected photo URL and convert to **base64** for embedding.
7. Pass all data to the PDF renderer and stream the result as `application/pdf` with `Content-Disposition: attachment; filename="<game-name>-report.pdf"`.

**Error handling:**
- 401 if token invalid or game not owned by user.
- 404 if game not found.
- 500 with JSON error if PDF generation fails.

---

## Data Available (no new DB columns needed)

| Need | Source |
|---|---|
| Game name, date, duration | `games.name`, `games.started_at`, `games.duration_minutes` |
| Final standings | `teams` sorted by `score DESC` |
| Missions completed per team | `teams.completed.length` |
| Score per mission | `teams.mission_scores: Record<string, number>` |
| Mission completion order | `teams.completed: string[]` (order of IDs = order completed) |
| Best mission per team | `max(mission_scores)` per team |
| Fastest team | `teams.finished_at - games.started_at` (smallest positive delta) |
| Most active team | `max(completed.length)` |
| Best single performance | `max(mission_scores[missionId])` across all teams |
| Top photo per team | `photo_submissions` filtered + grouped by team, max `points_awarded` |
| Mission names/icons | `MISSIONS` array from `lib/missions.ts` + `custom_missions` fetched by the game owner's `user_id` (available from `validateAdminToken`) |

**Score curve approximation:** cumulative sum of `mission_scores` in the order missions appear in `team.completed`. Not clock-time accurate but visually meaningful.

---

## PDF Layout

All pages use: dark background (`#0f0f14`), accent color (`#6c63ff`), gold for top 3 (`#f5c518`), Helvetica (built-in PDF font — Sora is a web font and not embeddable in react-pdf without self-hosting). Footer on every page: "Powered by GameOn".

### Page 1 — Cover
- Game name (large, centered)
- Date (formatted: "28 maj 2026")
- Duration + number of teams
- "Powered by GameOn" footer

### Page 2 — Final Standings
- Heading: "FINAL STANDINGS"
- Table rows: rank | medal (🥇🥈🥉 for top 3, number otherwise) | team name | score | missions completed
- Alternating row shading for readability

### Page 3 — Score Progression
- Heading: "SCORE PROGRESSION"
- SVG line chart drawn inline:
  - X-axis: mission number (1 … max completed by any team)
  - Y-axis: cumulative score (0 … max team score)
  - One line per team, up to 8 distinct colors (`#6c63ff`, `#f5c518`, `#e74c3c`, `#2ecc71`, `#e67e22`, `#1abc9c`, `#e91e8c`, `#3498db`); if more than 8 teams, remaining teams use `#555`
  - Legend below the chart (team name + color swatch)
- Subtitle: "Based on order missions were completed"

### Page 4 — Best Mission Per Team
- Heading: "BEST MISSION PER TEAM"
- Table rows: team name | mission icon + name | points scored
- Sorted by points descending

### Page 5 — Fun Stats
Three stat cards in a row:
- 🏃 **Snabbaste lag** — team name + time from start to `finished_at` (formatted mm:ss). If no team has `finished_at`, shows "–".
- 📋 **Mest aktiva lag** — team name + number of completed missions.
- ⚡ **Bästa enskilda prestation** — team name + mission icon/name + points.

### Page 6+ — Photos
- Only rendered if at least one approved photo exists.
- Heading: "PHOTO HIGHLIGHTS"
- 2-column grid; each cell: photo (max height 180pt, width fills column, `objectFit: cover`), team name below, points in corner badge.
- Teams with no rated photo are excluded from this section.

---

## Files Created / Modified

| File | Action |
|---|---|
| `lib/pdf-report.tsx` | Create — React-PDF components for all pages |
| `app/api/admin/game/[id]/report/route.ts` | Create — fetches data, renders PDF, streams response |
| `components/screens/AdminScreen.tsx` | Modify — add "📄 Ladda ner rapport" button in dashboard view for finished games |

---

## Dependencies

```bash
npm install @react-pdf/renderer
```

`@react-pdf/renderer` runs in Node.js (server-side only). It must **not** be imported in any client component.

---

## Out of Scope (v1)

- Storing generated PDFs in Supabase Storage
- Scheduled/emailed reports
- Custom branding per customer (logo upload)
- Exact per-mission timestamps (requires schema change)
- "Most frozen team" stat (requires tracking freeze events)
