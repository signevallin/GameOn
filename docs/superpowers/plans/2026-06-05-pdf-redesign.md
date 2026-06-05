# PDF Report Redesign + Mission Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the PDF report to match the GameOn landing page visual identity, remove the Score Progression page, and add a Mission Analytics page with per-mission completion rates and score statistics.

**Architecture:** Two files change: `lib/pdf-report.tsx` gets new colors, a new `MissionAnalyticsPage` component, an updated `Footer` wordmark, and loses `ScoreChartPage`; `app/api/admin/game/[id]/report/route.ts` computes `missionStats` from the existing `teams` array and passes it through `ReportData`.

**Tech Stack:** @react-pdf/renderer, TypeScript, Next.js 14 App Router

---

### Task 1: Add MissionStat type, update ReportData, compute in route.ts

**Files:**
- Modify: `lib/pdf-report.tsx` (types section, lines 28–55)
- Modify: `app/api/admin/game/[id]/report/route.ts` (lines ~128–145)

- [ ] **Step 1: Add MissionStat type and update ReportData in lib/pdf-report.tsx**

In `lib/pdf-report.tsx`, after the `ReportPhoto` type add the new type, then replace the `ReportData` type:

```ts
export type MissionStat = {
  completed: number;   // number of teams that completed this mission
  totalScore: number;  // sum of all scores across all teams
  topScore: number;    // highest single score for this mission
};

export type ReportData = {
  game: {
    name: string;
    started_at: string;
    duration_minutes: number;
  };
  teams: ReportTeam[];
  photos: ReportPhoto[];
  missionMap: Record<string, { name: string; icon: string }>;
  teamCount: number;
  missionStats: Record<string, MissionStat>;
};
```

- [ ] **Step 2: Compute missionStats and teamCount in route.ts**

In `app/api/admin/game/[id]/report/route.ts`, after the `// 6. Convert photos to base64` block and before `// 7. Render PDF`, add:

```ts
// 6b. Compute per-mission stats from teams data
const missionStats: Record<string, { completed: number; totalScore: number; topScore: number }> = {};
for (const team of teams) {
  for (const mId of (team.completed ?? [])) {
    const pts = (team.mission_scores ?? {})[mId] ?? 0;
    if (!missionStats[mId]) missionStats[mId] = { completed: 0, totalScore: 0, topScore: 0 };
    missionStats[mId].completed += 1;
    missionStats[mId].totalScore += pts;
    if (pts > missionStats[mId].topScore) missionStats[mId].topScore = pts;
  }
}
```

Then update the `data` object to include the new fields:

```ts
const data: ReportData = {
  game: {
    name: game.name,
    started_at: game.started_at ?? new Date().toISOString(),
    duration_minutes: game.duration_minutes,
  },
  teams,
  photos: reportPhotos,
  missionMap,
  teamCount: teams.length,
  missionStats,
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/signevallin/Desktop/GameOn && npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

Expected: `✓ Compiled successfully` with no TypeScript errors. Fix any errors before continuing.

- [ ] **Step 4: Commit**

```bash
git add lib/pdf-report.tsx app/api/admin/game/\[id\]/report/route.ts
git commit -m "feat: add MissionStat type and per-mission stats computation to PDF report"
```

---

### Task 2: Update color palette, imports, Footer, and CoverPage

**Files:**
- Modify: `lib/pdf-report.tsx`

- [ ] **Step 1: Replace the C color constants and TEAM_COLORS**

Replace the `C` object and `TEAM_COLORS` array at the top of `lib/pdf-report.tsx`:

```ts
const C = {
  bg:     '#0D1520',
  card:   '#162030',
  accent: '#7CBDD4',
  gold:   '#DEBB6B',
  text:   '#DCE4EE',
  muted:  '#8FA8C0',
  green:  '#8CBF9B',
  orange: '#D4875A',
  row:    '#111C2A',
};

const TEAM_COLORS = [
  '#7CBDD4', '#DEBB6B', '#D4875A', '#8CBF9B',
  '#A68FD4', '#E091B8', '#6BBFA8', '#A8C8D4',
];
```

- [ ] **Step 2: Add Circle to the react-pdf import**

Update the import line at the top of `lib/pdf-report.tsx`:

```ts
import {
  Document, Page, Text, View, Image, Svg, Circle, Line, Path,
  StyleSheet,
} from '@react-pdf/renderer';
```

- [ ] **Step 3: Update shared.page background and shared.heading color**

In the `shared` StyleSheet, update `page` background and `heading` color:

```ts
const shared = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    color: C.text,
    fontSize: 11,
  },
  heading: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: C.accent,
    letterSpacing: 2,
    marginBottom: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 40,
    right: 40,
    fontSize: 9,
    color: C.muted,
  },
});
```

- [ ] **Step 4: Rewrite the Footer component**

Replace the `Footer` function with the GameOn wordmark version:

```tsx
function Footer() {
  return (
    <View style={[shared.footer, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.text }}>Game</Text>
      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.accent }}>On</Text>
      <Text style={{ fontSize: 9, color: C.muted }}> · Powered by GameOn</Text>
    </View>
  );
}
```

- [ ] **Step 5: Rewrite CoverPage**

Replace the entire `CoverPage` function (lines 106–140):

```tsx
function CoverPage({ game, teamCount }: { game: ReportData['game']; teamCount: number }) {
  return (
    <Page size="A4" style={shared.page}>
      {/* Radial glow behind wordmark */}
      <Svg width={300} height={300} style={{ position: 'absolute', top: 160, left: 147 }}>
        <Circle cx={150} cy={150} r={170} fill={C.accent} fillOpacity={0.04} />
        <Circle cx={150} cy={150} r={110} fill={C.accent} fillOpacity={0.05} />
        <Circle cx={150} cy={150} r={60}  fill={C.accent} fillOpacity={0.07} />
      </Svg>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {/* Label */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 20 }}>
          <Text style={{ fontSize: 9, color: C.muted, letterSpacing: 3 }}>GAME REPORT BY </Text>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.text }}>Game</Text>
          <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.accent }}>On</Text>
        </View>

        {/* Game name */}
        <Text style={{
          fontSize: 30,
          fontFamily: 'Helvetica-Bold',
          color: C.text,
          textAlign: 'center',
          marginBottom: 28,
        }}>
          {game.name}
        </Text>

        {/* Info card */}
        <View style={{
          backgroundColor: C.card,
          borderRadius: 8,
          paddingVertical: 16,
          paddingHorizontal: 32,
          alignItems: 'center',
        }}>
          <Text style={{ color: C.muted, fontSize: 12, marginBottom: 5 }}>
            {formatDate(game.started_at)}
          </Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>
            {game.duration_minutes} minuter · {teamCount} lag
          </Text>
        </View>
      </View>
      <Footer />
    </Page>
  );
}
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/signevallin/Desktop/GameOn && npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Commit**

```bash
git add lib/pdf-report.tsx
git commit -m "feat: update PDF color palette, footer wordmark, and cover page to match landing page"
```

---

### Task 3: Update existing pages to new palette + delete ScoreChartPage

**Files:**
- Modify: `lib/pdf-report.tsx`

- [ ] **Step 1: Rewrite StandingsPage**

Replace the entire `StandingsPage` function:

```tsx
function StandingsPage({ teams }: { teams: ReportTeam[] }) {
  return (
    <Page size="A4" style={shared.page}>
      <Text style={shared.heading}>FINAL STANDINGS</Text>

      <View style={{
        flexDirection: 'row',
        paddingBottom: 8,
        borderBottomColor: C.accent,
        borderBottomWidth: 1,
        marginBottom: 2,
      }}>
        <Text style={{ width: 44, fontSize: 10, color: C.muted, fontFamily: 'Helvetica-Bold' }}>#</Text>
        <Text style={{ flex: 1, fontSize: 10, color: C.muted, fontFamily: 'Helvetica-Bold' }}>TEAM</Text>
        <Text style={{ width: 70, fontSize: 10, color: C.muted, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>POÄNG</Text>
        <Text style={{ width: 70, fontSize: 10, color: C.muted, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>UPPDRAG</Text>
      </View>

      {teams.map((t, i) => (
        <View key={t.id} style={{
          flexDirection: 'row',
          paddingVertical: 9,
          paddingHorizontal: 2,
          backgroundColor: i % 2 === 0 ? C.row : 'transparent',
          alignItems: 'center',
        }}>
          <Text style={{ width: 44, fontSize: 13 }}>{medalOrRank(i + 1)}</Text>
          <Text style={{
            flex: 1,
            fontFamily: i < 3 ? 'Helvetica-Bold' : 'Helvetica',
            color: i === 0 ? C.gold : C.text,
          }}>
            {t.name}
          </Text>
          <Text style={{
            width: 70,
            textAlign: 'right',
            fontFamily: 'Helvetica-Bold',
            color: i === 0 ? C.gold : C.text,
          }}>
            {t.score}
          </Text>
          <Text style={{ width: 70, textAlign: 'right', color: C.muted }}>
            {(t.completed ?? []).length}
          </Text>
        </View>
      ))}

      <Footer />
    </Page>
  );
}
```

- [ ] **Step 2: Rewrite BestMissionPage**

Replace the entire `BestMissionPage` function:

```tsx
function BestMissionPage({
  teams,
  missionMap,
}: {
  teams: ReportTeam[];
  missionMap: ReportData['missionMap'];
}) {
  const rows = teams
    .map(t => {
      const entries = Object.entries(t.mission_scores ?? {});
      if (entries.length === 0) return null;
      const [mId, pts] = entries.sort((a, b) => b[1] - a[1])[0];
      const m = missionMap[mId];
      return {
        teamName: t.name,
        missionLabel: m ? `${m.icon} ${m.name}` : mId,
        pts,
      };
    })
    .filter((r): r is { teamName: string; missionLabel: string; pts: number } => r !== null)
    .sort((a, b) => b.pts - a.pts);

  return (
    <Page size="A4" style={shared.page}>
      <Text style={shared.heading}>BEST MISSION PER TEAM</Text>

      <View style={{
        flexDirection: 'row',
        paddingBottom: 8,
        borderBottomColor: C.accent,
        borderBottomWidth: 1,
        marginBottom: 2,
      }}>
        <Text style={{ flex: 1, fontSize: 10, color: C.muted, fontFamily: 'Helvetica-Bold' }}>TEAM</Text>
        <Text style={{ flex: 2, fontSize: 10, color: C.muted, fontFamily: 'Helvetica-Bold' }}>UPPDRAG</Text>
        <Text style={{ width: 60, fontSize: 10, color: C.muted, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>POÄNG</Text>
      </View>

      {rows.map((r, i) => (
        <View key={i} style={{
          flexDirection: 'row',
          paddingVertical: 9,
          paddingHorizontal: 2,
          backgroundColor: i % 2 === 0 ? C.row : 'transparent',
        }}>
          <Text style={{ flex: 1, color: C.text }}>{r.teamName}</Text>
          <Text style={{ flex: 2, color: C.muted }}>{r.missionLabel}</Text>
          <Text style={{ width: 60, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: C.accent }}>
            {r.pts}
          </Text>
        </View>
      ))}

      <Footer />
    </Page>
  );
}
```

- [ ] **Step 3: Rewrite FunStatsPage**

Replace the entire `FunStatsPage` function:

```tsx
function FunStatsPage({
  teams,
  game,
  missionMap,
}: {
  teams: ReportTeam[];
  game: ReportData['game'];
  missionMap: ReportData['missionMap'];
}) {
  const fastest = teams
    .filter(t => t.finished_at != null && game.started_at)
    .map(t => ({
      name: t.name,
      secs: Math.floor(
        (new Date(t.finished_at!).getTime() - new Date(game.started_at).getTime()) / 1000
      ),
    }))
    .filter(t => t.secs > 0)
    .sort((a, b) => a.secs - b.secs)[0] ?? null;

  const mostActive = [...teams].sort((a, b) =>
    (b.completed ?? []).length - (a.completed ?? []).length
  )[0] ?? null;

  let bestPerf: { teamName: string; missionLabel: string; pts: number } | null = null;
  for (const t of teams) {
    for (const [mId, pts] of Object.entries(t.mission_scores ?? {})) {
      if (!bestPerf || pts > bestPerf.pts) {
        const m = missionMap[mId];
        bestPerf = { teamName: t.name, missionLabel: m ? `${m.icon} ${m.name}` : mId, pts };
      }
    }
  }

  const cards = [
    {
      emoji: '🏃',
      title: 'Snabbaste lag',
      main: fastest?.name ?? '–',
      sub: fastest ? formatDuration(fastest.secs) : 'Inget lag klart',
    },
    {
      emoji: '📋',
      title: 'Mest aktiva lag',
      main: mostActive?.name ?? '–',
      sub: `${(mostActive?.completed ?? []).length} uppdrag`,
    },
    {
      emoji: '⚡',
      title: 'Bästa enskilda prestation',
      main: bestPerf?.teamName ?? '–',
      sub: bestPerf ? `${bestPerf.missionLabel} · ${bestPerf.pts} pts` : '–',
    },
  ];

  return (
    <Page size="A4" style={shared.page}>
      <Text style={shared.heading}>FUN STATS</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        {cards.map((card, i) => (
          <View key={i} style={{
            flex: 1,
            backgroundColor: C.card,
            borderRadius: 8,
            paddingVertical: 20,
            paddingHorizontal: 14,
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 24, marginBottom: 8 }}>{card.emoji}</Text>
            <Text style={{ fontSize: 8, color: C.muted, textAlign: 'center', letterSpacing: 1, marginBottom: 8 }}>
              {card.title.toUpperCase()}
            </Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 13, color: C.accent, textAlign: 'center', marginBottom: 6 }}>
              {card.main}
            </Text>
            <Text style={{ fontSize: 9, color: C.muted, textAlign: 'center' }}>
              {card.sub}
            </Text>
          </View>
        ))}
      </View>
      <Footer />
    </Page>
  );
}
```

- [ ] **Step 4: Rewrite PhotosPage**

Replace the entire `PhotosPage` function:

```tsx
function PhotosPage({ photos }: { photos: ReportPhoto[] }) {
  const rows: ReportPhoto[][] = [];
  for (let i = 0; i < photos.length; i += 2) {
    rows.push(photos.slice(i, i + 2));
  }

  return (
    <Page size="A4" style={shared.page}>
      <Text style={shared.heading}>PHOTO HIGHLIGHTS</Text>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          {row.map((photo, pi) => (
            <View key={pi} style={{ flex: 1, backgroundColor: C.card, borderRadius: 8, overflow: 'hidden' }}>
              <Image
                src={photo.base64}
                style={{ width: '100%', height: 180, objectFit: 'cover' }}
              />
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 6,
                paddingHorizontal: 10,
              }}>
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.text }}>{photo.teamName}</Text>
                <Text style={{ fontSize: 10, color: C.accent, fontFamily: 'Helvetica-Bold' }}>
                  {photo.pointsAwarded} pts
                </Text>
              </View>
            </View>
          ))}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
      <Footer />
    </Page>
  );
}
```

- [ ] **Step 5: Delete ScoreChartPage**

Remove the entire `ScoreChartPage` function — the block starting with the comment `// ── Page 3: Score Progression Chart ─` through and including its closing `}`.

- [ ] **Step 6: Verify build**

```bash
cd /Users/signevallin/Desktop/GameOn && npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

Expected: `✓ Compiled successfully`.

- [ ] **Step 7: Commit**

```bash
git add lib/pdf-report.tsx
git commit -m "feat: update all PDF pages to landing page palette, remove score progression page"
```

---

### Task 4: Add MissionAnalyticsPage + update buildReport

**Files:**
- Modify: `lib/pdf-report.tsx`

- [ ] **Step 1: Add rateColor helper after the medalOrRank function**

After the `medalOrRank` function, add:

```ts
function rateColor(rate: number): string {
  if (rate >= 75) return C.green;   // #8CBF9B
  if (rate >= 40) return C.accent;  // #7CBDD4
  return C.orange;                   // #D4875A
}
```

- [ ] **Step 2: Add MissionAnalyticsPage component**

Add this component after `StandingsPage` and before `BestMissionPage`:

```tsx
function MissionAnalyticsPage({
  missionStats,
  missionMap,
  teamCount,
}: {
  missionStats: ReportData['missionStats'];
  missionMap: ReportData['missionMap'];
  teamCount: number;
}) {
  // Sort by completion rate desc, skip zero-completion missions
  const rows = Object.entries(missionStats)
    .filter(([, s]) => s.completed > 0)
    .map(([mId, s]) => {
      const rate = Math.round((s.completed / (teamCount || 1)) * 100);
      const avg  = Math.round(s.totalScore / s.completed);
      const m    = missionMap[mId];
      return {
        mId,
        label:     m ? `${m.icon} ${m.name}` : mId,
        shortName: m ? (m.name.length > 18 ? m.name.slice(0, 17) + '…' : m.name) : mId,
        completed: s.completed,
        rate,
        avg,
        top: s.topScore,
      };
    })
    .sort((a, b) => b.rate - a.rate);

  return (
    <Page size="A4" style={shared.page}>
      <Text style={shared.heading}>MISSION ANALYTICS</Text>
      <Text style={{ fontSize: 9, color: C.muted, marginBottom: 12 }}>
        Sorterat efter completion rate
      </Text>

      {rows.length === 0 ? (
        <Text style={{ color: C.muted, fontSize: 11 }}>Inga uppdrag klarades under detta spel.</Text>
      ) : (
        <>
          {/* ── Table header ── */}
          <View style={{
            flexDirection: 'row',
            paddingBottom: 8,
            borderBottomColor: C.accent,
            borderBottomWidth: 1,
            marginBottom: 2,
          }}>
            <Text style={{ flex: 2, fontSize: 9, color: C.muted, fontFamily: 'Helvetica-Bold' }}>UPPDRAG</Text>
            <Text style={{ width: 55, fontSize: 9, color: C.muted, fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>KLARADE</Text>
            <Text style={{ width: 50, fontSize: 9, color: C.muted, fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>RATE</Text>
            <Text style={{ width: 55, fontSize: 9, color: C.muted, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>SNITT</Text>
            <Text style={{ width: 55, fontSize: 9, color: C.muted, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>TOPP</Text>
          </View>

          {/* ── Table rows ── */}
          {rows.map((r, i) => {
            const color = rateColor(r.rate);
            return (
              <View key={r.mId} style={{
                flexDirection: 'row',
                paddingVertical: 7,
                paddingHorizontal: 2,
                backgroundColor: i % 2 === 0 ? C.row : 'transparent',
                alignItems: 'center',
              }}>
                <Text style={{ flex: 2, fontSize: 10, color: C.text }}>{r.label}</Text>
                <Text style={{ width: 55, fontSize: 10, textAlign: 'center', color }}>{r.completed}/{teamCount}</Text>
                <Text style={{ width: 50, fontSize: 10, textAlign: 'center', fontFamily: 'Helvetica-Bold', color }}>{r.rate}%</Text>
                <Text style={{ width: 55, fontSize: 10, textAlign: 'right', color: C.muted }}>{r.avg}</Text>
                <Text style={{ width: 55, fontSize: 10, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: C.gold }}>{r.top}</Text>
              </View>
            );
          })}

          {/* ── Progress bars ── */}
          <Text style={{ fontSize: 8, color: C.muted, letterSpacing: 1.5, marginTop: 20, marginBottom: 8 }}>
            COMPLETION RATE
          </Text>
          {rows.map(r => {
            const color = rateColor(r.rate);
            return (
              <View key={`bar-${r.mId}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                <Text style={{ width: 110, fontSize: 8, color: C.muted }}>{r.shortName}</Text>
                <View style={{ flex: 1, height: 5, backgroundColor: '#1C2D40', borderRadius: 3 }}>
                  <View style={{ width: `${r.rate}%`, height: 5, backgroundColor: color, borderRadius: 3 }} />
                </View>
                <Text style={{ width: 36, fontSize: 8, fontFamily: 'Helvetica-Bold', color, textAlign: 'right' }}>
                  {r.rate}%
                </Text>
              </View>
            );
          })}
        </>
      )}

      <Footer />
    </Page>
  );
}
```

- [ ] **Step 3: Update buildReport**

Replace the entire `buildReport` export at the bottom of `lib/pdf-report.tsx`:

```tsx
export function buildReport(data: ReportData): React.ReactElement {
  return (
    <Document>
      <CoverPage game={data.game} teamCount={data.teamCount} />
      <StandingsPage teams={data.teams} />
      <MissionAnalyticsPage
        missionStats={data.missionStats}
        missionMap={data.missionMap}
        teamCount={data.teamCount}
      />
      <BestMissionPage teams={data.teams} missionMap={data.missionMap} />
      <FunStatsPage teams={data.teams} game={data.game} missionMap={data.missionMap} />
      {data.photos.length > 0 && <PhotosPage photos={data.photos} />}
    </Document>
  );
}
```

- [ ] **Step 4: Run final build**

```bash
cd /Users/signevallin/Desktop/GameOn && npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add lib/pdf-report.tsx
git commit -m "feat: add MissionAnalyticsPage with completion rates and score stats"
```

---

### Task 5: Deploy + verify

**Files:** None

- [ ] **Step 1: Push to Vercel**

```bash
git push
```

- [ ] **Step 2: Verify the PDF in production**

1. Log in to playgameon.app
2. Navigate to a finished game in the admin dashboard
3. Click "📄 Ladda ner rapport"
4. Open the downloaded PDF and verify:
   - **Cover:** "GameOn" wordmark with "On" in cyan, subtle glow, game name and info card visible
   - **Standings:** cyan header line, gold for rank-1 team, alternating dark rows
   - **Mission Analytics:** table with rate column color-coded green/cyan/orange, progress bars below
   - **Best Mission:** cyan accent for points
   - **Fun Stats:** cyan accent for stat values
   - **Photos (if present):** cyan accent for photo points
   - **No score progression page anywhere in the document**
