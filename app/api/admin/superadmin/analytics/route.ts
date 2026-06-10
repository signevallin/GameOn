// app/api/admin/superadmin/analytics/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAdminToken, unauthorizedResponse } from '@/lib/auth-server';
import { MISSIONS } from '@/lib/missions';

export const dynamic = 'force-dynamic';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface AnalyticsGame {
  id: string;
  name: string | null;
  teamCount: number;
  topScore: number;
  finished: boolean;
  startedAt: string | null;
}

export interface AnalyticsCustomer {
  id: string;
  email: string;
  gameCount: number;
  avgTeams: number;
  completionRate: number;
  lastActive: string | null;
  plan: 'free' | 'pro' | 'studio';
  games: AnalyticsGame[];
}

export interface AnalyticsMissionStat {
  id: string;
  name: string;
  gameCount: number;
  completedCount: number;
  totalTeams: number;
  completionRate: number;
}

export interface AnalyticsKPIs {
  totalGames: number;
  finishedGames: number;
  activeCustomers: number;
  activeCustomers30d: number;
  completionRate: number;
  avgTeamsPerGame: number;
  totalTeams: number;
}

export interface AnalyticsResponse {
  kpis: AnalyticsKPIs;
  customers: AnalyticsCustomer[];
  missionStats: AnalyticsMissionStat[];
  gamesPerWeek: Array<{ weekLabel: string; count: number }>;
  planCounts: { free: number; pro: number; studio: number };
}

function isoWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.valueOf() - yearStart.valueOf()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

export async function POST(req: Request) {
  const admin = await validateAdminToken(req).catch(() => null);
  if (!admin?.isSuperAdmin) return unauthorizedResponse();

  const supabase = adminClient();

  // Fetch in parallel
  const [usersResult, gamesResult, teamsResult] = await Promise.all([
    supabase.auth.admin.listUsers(),
    supabase
      .from('games')
      .select('id, name, user_id, status, started_at, missions')
      .order('started_at', { ascending: false }),
    supabase
      .from('teams')
      .select('game_id, score, completed, finished_at'),
  ]);

  if (usersResult.error) {
    return NextResponse.json({ error: usersResult.error.message }, { status: 500 });
  }
  if (gamesResult.error) {
    return NextResponse.json({ error: gamesResult.error.message }, { status: 500 });
  }
  if (teamsResult.error) {
    return NextResponse.json({ error: teamsResult.error.message }, { status: 500 });
  }

  const users = usersResult.data.users;
  const games = gamesResult.data ?? [];
  const teams = teamsResult.data ?? [];

  // ── Games per week (last 7 ISO weeks) ────────────────────────────────────
  const now = new Date();
  const weekSlots: Array<{ weekLabel: string; year: number; week: number; count: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i * 7));
    const { week, year } = isoWeek(d);
    weekSlots.push({ weekLabel: `V${week}`, year, week, count: 0 });
  }
  for (const g of games) {
    if (!g.started_at) continue;
    const { week, year } = isoWeek(new Date(g.started_at));
    const slot = weekSlots.find(s => s.week === week && s.year === year);
    if (slot) slot.count++;
  }
  const gamesPerWeek = weekSlots.map(({ weekLabel, count }) => ({ weekLabel, count }));

  // Build a lookup: game_id → array of teams
  const teamsByGame: Record<string, { score: number; completed: string[]; finished_at: string | null }[]> = {};
  for (const t of teams) {
    if (!teamsByGame[t.game_id]) teamsByGame[t.game_id] = [];
    teamsByGame[t.game_id].push({
      score: t.score ?? 0,
      completed: (t.completed ?? []) as string[],
      finished_at: t.finished_at ?? null,
    });
  }

  // Build a lookup: mission_id → mission name
  const missionNameById: Record<string, string> = {};
  for (const m of MISSIONS) {
    missionNameById[m.id] = m.name;
  }

  // ── KPIs ────────────────────────────────────────────────────────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const finishedGames = games.filter(g => g.status === 'finished').length;
  const customerIdsWithGames = new Set(games.map(g => g.user_id).filter(Boolean));
  const customerIdsActive30d = new Set(
    games
      .filter(g => g.started_at && g.started_at >= thirtyDaysAgo)
      .map(g => g.user_id)
      .filter(Boolean)
  );
  const totalTeamCount = teams.length;
  const avgTeamsPerGame = games.length > 0 ? totalTeamCount / games.length : 0;

  const kpis: AnalyticsKPIs = {
    totalGames: games.length,
    finishedGames,
    activeCustomers: customerIdsWithGames.size,
    activeCustomers30d: customerIdsActive30d.size,
    completionRate: games.length > 0 ? finishedGames / games.length : 0,
    avgTeamsPerGame: Math.round(avgTeamsPerGame * 10) / 10,
    totalTeams: totalTeamCount,
  };

  // ── Customers ────────────────────────────────────────────────────────────
  const gamesByUser: Record<string, typeof games> = {};
  for (const g of games) {
    if (!g.user_id) continue;
    if (!gamesByUser[g.user_id]) gamesByUser[g.user_id] = [];
    gamesByUser[g.user_id].push(g);
  }

  const customers: Omit<AnalyticsCustomer, 'plan'>[] = users
    .filter(u => u.app_metadata?.role !== 'superadmin')
    .map(u => {
      const userGames = gamesByUser[u.id] ?? [];
      const userGameDetails: AnalyticsGame[] = userGames.map(g => {
        const gt = teamsByGame[g.id] ?? [];
        const topScore = gt.length > 0 ? Math.max(...gt.map(t => t.score)) : 0;
        return {
          id: g.id,
          name: g.name,
          teamCount: gt.length,
          topScore,
          finished: g.status === 'finished',
          startedAt: g.started_at ?? null,
        };
      });
      const lastActive = userGames.length > 0 ? (userGames[0].started_at ?? null) : null;
      const finishedCount = userGames.filter(g => g.status === 'finished').length;
      const totalTeamsForUser = userGames.reduce((sum, g) => sum + (teamsByGame[g.id]?.length ?? 0), 0);
      const avgTeams = userGames.length > 0 ? totalTeamsForUser / userGames.length : 0;

      return {
        id: u.id,
        email: u.email ?? '(no email)',
        gameCount: userGames.length,
        avgTeams: Math.round(avgTeams * 10) / 10,
        completionRate: userGames.length > 0 ? finishedCount / userGames.length : 0,
        lastActive,
        games: userGameDetails,
      };
    })
    .filter(c => c.gameCount > 0)
    .sort((a, b) => {
      if (!a.lastActive && !b.lastActive) return 0;
      if (!a.lastActive) return 1;
      if (!b.lastActive) return -1;
      return b.lastActive.localeCompare(a.lastActive);
    });

  // ── Subscription plans ────────────────────────────────────────────────────
  const customerIds = customers.map(c => c.id);
  const { data: subsData, error: subsError } = customerIds.length > 0
    ? await supabase
        .from('subscriptions')
        .select('user_id, plan, status')
        .in('user_id', customerIds)
    : { data: [], error: null };
  if (subsError) console.error('[analytics] subscriptions fetch failed:', subsError.message);

  const VALID_PLANS = new Set(['free', 'pro', 'studio'] as const);
  const planByUserId: Record<string, 'free' | 'pro' | 'studio'> = {};
  for (const sub of (subsData ?? [])) {
    // includes 'active', 'trialing', 'past_due' — all treated as active plans
    if (sub.status !== 'canceled' && VALID_PLANS.has(sub.plan as 'free' | 'pro' | 'studio')) {
      planByUserId[sub.user_id] = sub.plan as 'free' | 'pro' | 'studio';
    }
  }

  const customersWithPlan: AnalyticsCustomer[] = customers.map(c => ({
    ...c,
    plan: planByUserId[c.id] ?? 'free' as const,
  }));

  const planCounts = { free: 0, pro: 0, studio: 0 };
  for (const c of customersWithPlan) {
    planCounts[c.plan]++;
  }

  // ── Mission stats ─────────────────────────────────────────────────────────
  const missionStatsMap: Record<string, { gameCount: number; totalTeams: number; completedCount: number }> = {};

  for (const g of games) {
    const missionIds: string[] = (g.missions ?? []) as string[];
    const gt = teamsByGame[g.id] ?? [];
    for (const mId of missionIds) {
      if (!missionStatsMap[mId]) {
        missionStatsMap[mId] = { gameCount: 0, totalTeams: 0, completedCount: 0 };
      }
      missionStatsMap[mId].gameCount += 1;
      missionStatsMap[mId].totalTeams += gt.length;
      missionStatsMap[mId].completedCount += gt.filter(t => t.completed.includes(mId)).length;
    }
  }

  const missionStats: AnalyticsMissionStat[] = Object.entries(missionStatsMap)
    .map(([id, s]) => ({
      id,
      name: missionNameById[id] ?? id,
      gameCount: s.gameCount,
      completedCount: s.completedCount,
      totalTeams: s.totalTeams,
      completionRate: s.totalTeams > 0 ? s.completedCount / s.totalTeams : 0,
    }))
    .sort((a, b) => b.gameCount - a.gameCount);

  const response: AnalyticsResponse = { kpis, customers: customersWithPlan, missionStats, gamesPerWeek, planCounts };
  return NextResponse.json(response);
}
