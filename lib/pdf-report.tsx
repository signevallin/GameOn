// lib/pdf-report.tsx
// SERVER-ONLY — imported only from API routes. Never import in client components.
import React from 'react';
import {
  Document, Page, Text, View, Image, Svg, Circle, Line, Path,
  StyleSheet,
} from '@react-pdf/renderer';

// ── Colors ────────────────────────────────────────────────────────────────
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

// ── Types ─────────────────────────────────────────────────────────────────
export type ReportTeam = {
  id: string;
  name: string;
  score: number;
  completed: string[];
  mission_scores: Record<string, number>;
  finished_at: string | null;
};

export type ReportPhoto = {
  teamName: string;
  base64: string;
  pointsAwarded: number;
};

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
  teams: ReportTeam[];   // sorted by score desc
  photos: ReportPhoto[];
  missionMap: Record<string, { name: string; icon: string }>;
  teamCount: number;
  missionStats: Record<string, MissionStat>;
};

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function medalOrRank(rank: number): string {
  // No emojis — Helvetica has no emoji glyphs
  return String(rank);
}


function rateColor(rate: number): string {
  if (rate >= 75) return C.green;   // #8CBF9B
  if (rate >= 40) return C.accent;  // #7CBDD4
  return C.orange;                   // #D4875A
}

// ── Shared styles ─────────────────────────────────────────────────────────
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

function Footer() {
  return (
    <View style={[shared.footer, { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.text }}>Game</Text>
      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.accent }}>On</Text>
      <Text style={{ fontSize: 9, color: C.muted }}> · Powered by GameOn</Text>
    </View>
  );
}

// ── Page 1: Cover ─────────────────────────────────────────────────────────
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
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
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

// ── Page 2: Final Standings ────────────────────────────────────────────────
function StandingsPage({ teams }: { teams: ReportTeam[] }) {
  return (
    <Page size="A4" style={shared.page}>
      <Text style={shared.heading}>FINAL STANDINGS</Text>

      {/* Header */}
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
          <Text style={{
            width: 44,
            fontSize: 11,
            fontFamily: i < 3 ? 'Helvetica-Bold' : 'Helvetica',
            color: i === 0 ? C.gold : i === 1 ? '#B0C8D8' : i === 2 ? '#C8A870' : C.muted,
          }}>{medalOrRank(i + 1)}</Text>
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
            {t.completed.length}
          </Text>
        </View>
      ))}

      <Footer />
    </Page>
  );
}

// ── Page 3: Mission Analytics ─────────────────────────────────────────────
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
        label:     m ? m.name : mId,
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

// ── Page 4: Best Mission Per Team ─────────────────────────────────────────
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
        missionLabel: m ? m.name : mId,
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

// ── Page 5: Fun Stats ─────────────────────────────────────────────────────
function FunStatsPage({
  teams,
  game,
  missionMap,
}: {
  teams: ReportTeam[];
  game: ReportData['game'];
  missionMap: ReportData['missionMap'];
}) {
  // Fastest team (smallest elapsed time to finished_at)
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

  // Most missions completed
  const mostActive = [...teams].sort((a, b) => b.completed.length - a.completed.length)[0] ?? null;

  // Best single mission score across all teams
  let bestPerf: { teamName: string; missionLabel: string; pts: number } | null = null;
  for (const t of teams) {
    for (const [mId, pts] of Object.entries(t.mission_scores)) {
      if (!bestPerf || pts > bestPerf.pts) {
        const m = missionMap[mId];
        bestPerf = { teamName: t.name, missionLabel: m ? m.name : mId, pts };
      }
    }
  }

  const cards = [
    {
      title: 'SNABBASTE LAG',
      main: fastest?.name ?? '–',
      sub: fastest ? formatDuration(fastest.secs) : 'Inget lag klart',
    },
    {
      title: 'MEST AKTIVA LAG',
      main: mostActive?.name ?? '–',
      sub: `${(mostActive?.completed ?? []).length} uppdrag`,
    },
    {
      title: 'BÄSTA PRESTATION',
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
            paddingVertical: 24,
            paddingHorizontal: 14,
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 8, color: C.muted, textAlign: 'center', letterSpacing: 1.5, marginBottom: 10 }}>
              {card.title}
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

// ── Page 6+: Photo Highlights ─────────────────────────────────────────────
function PhotosPage({ photos }: { photos: ReportPhoto[] }) {
  // Pair into rows of 2
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
          {/* Fill empty slot if odd number of photos */}
          {row.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      ))}
      <Footer />
    </Page>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
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
