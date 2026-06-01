// lib/pdf-report.tsx
// SERVER-ONLY — imported only from API routes. Never import in client components.
import React from 'react';
import {
  Document, Page, Text, View, Image, Svg, Line, Path,
  StyleSheet,
} from '@react-pdf/renderer';

// ── Colors ────────────────────────────────────────────────────────────────
const C = {
  bg: '#0f0f14',
  card: '#1a1a2e',
  accent: '#6c63ff',
  gold: '#f5c518',
  text: '#ffffff',
  muted: '#888888',
  row: '#12121e',
};

const TEAM_COLORS = [
  '#6c63ff', '#f5c518', '#e74c3c', '#2ecc71',
  '#e67e22', '#1abc9c', '#e91e8c', '#3498db',
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

export type ReportData = {
  game: {
    name: string;
    started_at: string;
    duration_minutes: number;
  };
  teams: ReportTeam[];   // sorted by score desc
  photos: ReportPhoto[];
  missionMap: Record<string, { name: string; icon: string }>;
};

// ── Helpers ───────────────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['jan','feb','mar','apr','maj','jun','jul','aug','sep','okt','nov','dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function medalOrRank(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
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
    fontSize: 18,
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
    textAlign: 'center',
  },
});

function Footer() {
  return <Text style={shared.footer}>Powered by GameOn</Text>;
}

// ── Page 1: Cover ─────────────────────────────────────────────────────────
function CoverPage({ game, teamCount }: { game: ReportData['game']; teamCount: number }) {
  return (
    <Page size="A4" style={shared.page}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 9, color: C.muted, letterSpacing: 3, marginBottom: 16 }}>
          GAME REPORT
        </Text>
        <Text style={{
          fontSize: 34,
          fontFamily: 'Helvetica-Bold',
          color: C.text,
          textAlign: 'center',
          marginBottom: 28,
        }}>
          {game.name}
        </Text>
        <View style={{
          backgroundColor: C.card,
          borderRadius: 8,
          paddingVertical: 16,
          paddingHorizontal: 32,
          alignItems: 'center',
        }}>
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 6 }}>
            {formatDate(game.started_at)}
          </Text>
          <Text style={{ color: C.muted, fontSize: 13 }}>
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
            {t.completed.length}
          </Text>
        </View>
      ))}

      <Footer />
    </Page>
  );
}

// ── Page 3: Score Progression Chart ───────────────────────────────────────
function ScoreChartPage({ teams }: { teams: ReportTeam[] }) {
  const maxMissions = Math.max(...teams.map(t => t.completed.length), 1);
  const maxScore = Math.max(...teams.map(t => t.score), 1);

  // Build cumulative score arrays
  const curves = teams.map(t => {
    const pts: number[] = [0];
    let cum = 0;
    for (const id of t.completed) {
      cum += t.mission_scores[id] ?? 0;
      pts.push(cum);
    }
    while (pts.length <= maxMissions) pts.push(cum);
    return pts;
  });

  // Chart dimensions (SVG units = pt)
  const W = 515, H = 240, PX = 30, PY = 16;
  const plotW = W - PX * 2;
  const plotH = H - PY * 2;

  const toX = (step: number) => PX + (step / maxMissions) * plotW;
  const toY = (score: number) => PY + plotH - (score / maxScore) * plotH;

  const buildPath = (pts: number[]) =>
    pts.map((s, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(s).toFixed(1)}`).join(' ');

  return (
    <Page size="A4" style={shared.page}>
      <Text style={shared.heading}>SCORE PROGRESSION</Text>
      <Text style={{ fontSize: 9, color: C.muted, marginBottom: 10 }}>
        Based on order missions were completed
      </Text>

      <Svg width={W} height={H}>
        {/* Y-axis */}
        <Line
          x1={PX} y1={PY} x2={PX} y2={PY + plotH}
          stroke={C.muted} strokeWidth={0.5}
        />
        {/* X-axis */}
        <Line
          x1={PX} y1={PY + plotH} x2={PX + plotW} y2={PY + plotH}
          stroke={C.muted} strokeWidth={0.5}
        />
        {/* Lines per team */}
        {curves.map((pts, i) => (
          <Path
            key={i}
            d={buildPath(pts)}
            stroke={TEAM_COLORS[i] ?? '#555555'}
            strokeWidth={1.5}
            fill="none"
          />
        ))}
      </Svg>

      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 4 }}>
        {teams.map((t, i) => (
          <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14, marginBottom: 4 }}>
            <View style={{
              width: 14,
              height: 4,
              backgroundColor: TEAM_COLORS[i] ?? '#555555',
              borderRadius: 2,
              marginRight: 5,
            }} />
            <Text style={{ fontSize: 9, color: C.text }}>{t.name}</Text>
          </View>
        ))}
      </View>

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
      const entries = Object.entries(t.mission_scores);
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
          <Text style={{ flex: 1 }}>{r.teamName}</Text>
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
      sub: `${mostActive?.completed.length ?? 0} uppdrag`,
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
                <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{photo.teamName}</Text>
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
      <CoverPage game={data.game} teamCount={data.teams.length} />
      <StandingsPage teams={data.teams} />
      <ScoreChartPage teams={data.teams} />
      <BestMissionPage teams={data.teams} missionMap={data.missionMap} />
      <FunStatsPage teams={data.teams} game={data.game} missionMap={data.missionMap} />
      {data.photos.length > 0 && <PhotosPage photos={data.photos} />}
    </Document>
  );
}
