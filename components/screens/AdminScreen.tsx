'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MISSIONS } from '@/lib/missions';
import { Team, Game, supabase } from '@/lib/supabase';
import GameOnLogo from '@/components/GameOnLogo';
import { QRCodeSVG } from 'qrcode.react';
import { SUPER_CATEGORIES, MISSION_SUPER_CATEGORY, SuperCategoryKey } from '@/lib/superCategories';

// ── Countdown hook (admin side) ──────────────────────────────────────────────
function useCountdown(game: Game | null) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!game || game.status !== 'active' || !game.started_at) { setSecondsLeft(null); return; }
    const endTime = new Date(game.started_at).getTime() + game.duration_minutes * 60 * 1000;
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [game]);
  return secondsLeft;
}

function fmtTimer(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

// Centered nav brand shared across all admin views
function NavCenter({ game }: { game: Game | null }) {
  const secondsLeft = useCountdown(game);
  const urgentTime = secondsLeft !== null && secondsLeft < 300;
  const timerColor = urgentTime ? 'var(--gold)' : 'var(--accent3)';
  return (
    <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', pointerEvents: 'none' }}>
      {game && (
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text)', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
          {game.name}
        </span>
      )}
      {game && game.status === 'active' && secondsLeft !== null && (
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '18px', color: timerColor, letterSpacing: '2px', lineHeight: 1, animation: urgentTime ? 'pulse 0.5s infinite alternate' : 'none' }}>
          ⏱ {fmtTimer(secondsLeft)}
        </span>
      )}
    </div>
  );
}

type HotPotatoState = {
  mission_id: string;
  expires_at: string;
  penalty_pts: number;
  game_id: string;
} | null;

type PowerUpsCardProps = {
  teams: Team[];
  gameId: string;
  gameMissionIds: string[];
  powerupsUsed: string[];
  puTargets: Record<string, string>;
  setPuTargets: (v: Record<string, string>) => void;
  puMessages: string;
  setPuMessages: (v: string) => void;
  puLoading: string | null;
  onActivate: (type: string) => void;
  // hot potato
  hotPotatoMissionId: string;
  setHotPotatoMissionId: (v: string) => void;
  onHotPotato: () => void;
  hotPotatoLoading: boolean;
  hotPotatoActive: HotPotatoState;
};

function useHotPotatoCountdown(hotPotatoActive: HotPotatoState) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!hotPotatoActive) { setSecondsLeft(null); return; }
    const endTime = new Date(hotPotatoActive.expires_at).getTime();
    const tick = () => setSecondsLeft(Math.max(0, Math.floor((endTime - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [hotPotatoActive]);
  return secondsLeft;
}

function PowerUpsCard({
  teams, gameId: _gameId, gameMissionIds, powerupsUsed, puTargets, setPuTargets, puMessages, setPuMessages, puLoading, onActivate,
  hotPotatoMissionId, setHotPotatoMissionId, onHotPotato, hotPotatoLoading, hotPotatoActive,
}: PowerUpsCardProps) {
  const hotPotatoSecondsLeft = useHotPotatoCountdown(hotPotatoActive);

  function isUsedKey(key: string) {
    return powerupsUsed.includes(key);
  }

  function usedOnNames(type: string) {
    return powerupsUsed
      .filter(k => k.startsWith(`${type}_`) && k !== `${type}_all`)
      .map(k => teams.find(t => t.id === k.slice(type.length + 1))?.name)
      .filter(Boolean) as string[];
  }

  function setTarget(type: string, teamId: string) {
    setPuTargets({ ...puTargets, [type]: teamId });
  }

  const selectStyle = {
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    fontFamily: "'Sora', sans-serif",
    fontSize: '12px',
    cursor: 'pointer',
    flex: 1,
    minWidth: 0,
  };

  const POWERS = [
    { type: 'sabotage', icon: '💻', label: 'Hack a team (-100p)', btn: 'HACK', allowAll: true },
    { type: 'double_points', icon: '🎯', label: 'Double points', btn: 'ACTIVATE', allowAll: true },
    { type: 'fake_hint', icon: '🔍', label: 'Fake hint', btn: 'SEND', allowAll: true },
  ];

  const finalFrenzyUsed = isUsedKey('final_frenzy_all');
  const finalFrenzyLoading = puLoading === 'final_frenzy';

  const hotPotatoMission = MISSIONS.find(m => m.id === hotPotatoActive?.mission_id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Final Frenzy (broadcast only) ── */}
      <div style={{
        background: finalFrenzyUsed ? 'var(--card)' : 'linear-gradient(135deg, rgba(208,117,125,0.12) 0%, rgba(222,187,107,0.10) 100%)',
        border: `1px solid ${finalFrenzyUsed ? 'var(--border)' : 'rgba(208,117,125,0.5)'}`,
        borderRadius: '12px',
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '22px', flexShrink: 0 }}>🔥</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: finalFrenzyUsed ? 'var(--muted)' : 'var(--accent2)' }}>Final Frenzy</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Doubles all points for ALL teams instantly</div>
          </div>
          {finalFrenzyUsed ? (
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent3)', background: 'rgba(140,191,155,0.12)', borderRadius: '6px', padding: '6px 12px', border: '1px solid var(--accent3)', flexShrink: 0 }}>✓ ACTIVATED</span>
          ) : (
            <>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', background: 'var(--surface)', borderRadius: '4px', padding: '2px 7px', border: '1px solid var(--border)', flexShrink: 0 }}>ALL TEAMS</span>
              <button
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '12px', flexShrink: 0, background: 'var(--accent2)', borderColor: 'var(--accent2)' }}
                disabled={finalFrenzyLoading}
                onClick={() => onActivate('final_frenzy')}
              >
                {finalFrenzyLoading ? '...' : 'ACTIVATE'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Per-team power-ups ── */}
      {POWERS.map(({ type, icon, label, btn, allowAll }) => {
        const selectedTeamId = puTargets[type] ?? '';
        const isAllSelected = selectedTeamId === 'all';
        const usedKey = isAllSelected ? `${type}_all` : selectedTeamId ? `${type}_${selectedTeamId}` : '';
        const alreadyUsed = usedKey ? isUsedKey(usedKey) : false;
        const isLoading = puLoading === type;
        const usedNames = usedOnNames(type);
        const allUsed = isUsedKey(`${type}_all`);

        return (
          <div key={type} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, flex: '0 0 auto' }}>{label}</span>
              <select
                value={selectedTeamId}
                onChange={e => setTarget(type, e.target.value)}
                style={selectStyle}
                disabled={allUsed}
              >
                <option value="">Select team…</option>
                {allowAll && (
                  <option value="all" disabled={allUsed}>{allUsed ? '✓ All teams (used)' : '📢 All teams'}</option>
                )}
                {teams.map(t => {
                  const tUsed = isUsedKey(`${type}_${t.id}`) || allUsed;
                  return (
                    <option key={t.id} value={t.id} disabled={tUsed}>
                      {t.name}{tUsed ? ' ✓' : ''}
                    </option>
                  );
                })}
              </select>
              <button
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '12px', flexShrink: 0 }}
                disabled={!selectedTeamId || alreadyUsed || isLoading || (type === 'fake_hint' && !puMessages.trim())}
                onClick={() => onActivate(type)}
              >
                {isLoading ? '...' : isAllSelected ? `${btn} ALL` : btn}
              </button>
            </div>
            {type === 'fake_hint' && (
              <input
                type="text"
                placeholder="Type your fake hint..."
                value={puMessages}
                onChange={e => setPuMessages(e.target.value)}
                style={{ marginTop: '10px', width: '100%', fontSize: '13px' }}
              />
            )}
            {allUsed && (
              <div style={{ fontSize: '12px', color: 'var(--accent3)', marginTop: '8px' }}>✓ Sent to all teams</div>
            )}
            {!allUsed && usedNames.length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--accent3)', marginTop: '8px' }}>
                ✓ Used on: {usedNames.join(', ')}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Time Bomb ── */}
      <div style={{
        background: hotPotatoActive
          ? 'linear-gradient(135deg, rgba(208,117,125,0.15) 0%, rgba(222,150,80,0.12) 100%)'
          : 'var(--card)',
        border: `1px solid ${hotPotatoActive ? 'rgba(208,117,125,0.6)' : 'var(--border)'}`,
        borderRadius: '12px',
        padding: '16px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '20px' }}>💣</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 800, color: hotPotatoActive ? 'var(--accent2)' : 'var(--text)' }}>Time Bomb</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '1px' }}>Teams must complete a mission in 3 min or lose 500 pts</div>
          </div>
          {hotPotatoActive && hotPotatoSecondsLeft !== null && (
            <div
              className={hotPotatoSecondsLeft <= 60 ? 'urgent-pulse' : ''}
              style={{
                background: hotPotatoSecondsLeft <= 30 ? 'var(--accent2)' : 'rgba(208,117,125,0.8)',
                color: '#fff', borderRadius: '8px', padding: '4px 10px',
                fontFamily: "'Sora', sans-serif", fontWeight: 800, fontSize: '14px',
                letterSpacing: '1px', flexShrink: 0,
                animation: hotPotatoSecondsLeft <= 30 ? 'pulse 0.5s infinite alternate' : hotPotatoSecondsLeft <= 60 ? undefined : 'none',
              }}
            >
              ⏱ {fmtTimer(hotPotatoSecondsLeft)}
            </div>
          )}
        </div>

        {hotPotatoActive ? (
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            <span style={{ fontWeight: 700, color: 'var(--text)' }}>Active:</span>{' '}
            {hotPotatoMission ? `${hotPotatoMission.icon} ${hotPotatoMission.name}` : hotPotatoActive.mission_id}
            {hotPotatoSecondsLeft === 0 && (
              <span style={{ color: 'var(--accent2)', marginLeft: '8px', fontWeight: 700 }}>⏰ Expired — resolving...</span>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={hotPotatoMissionId}
              onChange={e => setHotPotatoMissionId(e.target.value)}
              style={{ ...selectStyle }}
            >
              <option value="">Select mission…</option>
              {gameMissionIds.map(id => {
                const m = MISSIONS.find(x => x.id === id);
                if (!m) return null;
                return <option key={id} value={id}>{m.icon} {m.name}</option>;
              })}
            </select>
            <button
              className="btn btn-primary"
              style={{ padding: '8px 16px', fontSize: '12px', flexShrink: 0, background: 'var(--accent2)', borderColor: 'var(--accent2)' }}
              disabled={!hotPotatoMissionId || hotPotatoLoading}
              onClick={onHotPotato}
            >
              {hotPotatoLoading ? '...' : '💣 ACTIVATE'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type Props = { onLogout: () => void };
type AdminView = 'games' | 'create' | 'dashboard' | 'missions';

type MissionFormData = {
  name: string;
  icon: string;
  desc: string;
  difficulty: 'easy' | 'medium' | 'hard';
  maxPts: number;
  type: string;
  // trivia_quiz
  triviaRounds: { question: string; options: [string, string, string, string]; answer: string }[];
  // truefalse
  statements: { text: string; answer: boolean }[];
  // closest_wins
  closestQuestions: { q: string; answer: string; unit: string; hint: string }[];
  // pa_sparet
  clues: string[];
  paAnswer: string;
  // timeline
  timelineItems: { label: string; year: string }[];
  // photo
  photoPrompt: string;
};

const EMPTY_FORM: MissionFormData = {
  name: '', icon: '⭐', desc: '', difficulty: 'medium', maxPts: 500, type: '',
  triviaRounds: [], statements: [], closestQuestions: [],
  clues: [], paAnswer: '', timelineItems: [], photoPrompt: '',
};

const RANK_ICONS = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['var(--gold)', 'var(--silver)', 'var(--bronze)'];

type PhotoSubmission = {
  id: string; team_id: string; team_name: string;
  mission_id: string; photo_url: string; status: string;
  points_awarded: number | null; created_at: string;
};

type ScavengerSubmission = {
  id: string; team_id: string; team_name: string;
  game_id: string; mission_id: string;
  item_id: string; item_label: string;
  photo_url: string; status: string;
  points_awarded: number | null; created_at: string;
};
function getPointOptions(maxPts: number): number[] {
  const steps = 5;
  const step = Math.ceil(maxPts / steps / 100) * 100;
  const opts: number[] = [0];
  for (let i = 1; i <= steps; i++) {
    const v = Math.min(i * step, maxPts);
    if (!opts.includes(v)) opts.push(v);
  }
  if (!opts.includes(maxPts)) opts.push(maxPts);
  return opts;
}

export default function AdminScreen({ onLogout }: Props) {
  const [view, setView] = useState<AdminView>('games');
  const [games, setGames] = useState<Game[]>([]);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [photos, setPhotos] = useState<PhotoSubmission[]>([]);
  const [scavengerSubs, setScavengerSubs] = useState<ScavengerSubmission[]>([]);
  const [tab, setTab] = useState<'leaderboard' | 'progress' | 'photos' | 'powerups' | 'stats' | 'customers'>('leaderboard');
  const isMobile = useIsMobile();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [photoTeamFilter, setPhotoTeamFilter] = useState<string>('all');
  const [visiblePendingCount, setVisiblePendingCount] = useState(10);
  const [visibleScavengerCount, setVisibleScavengerCount] = useState(10);
  const [visibleRatedCount, setVisibleRatedCount] = useState(20);
  const [qrExpanded, setQrExpanded] = useState(false);
  const [photoModal, setPhotoModal] = useState<{ url: string; label: string } | null>(null);
  const [rated, setRated] = useState<Set<string>>(new Set());
  const [scavengerRated, setScavengerRated] = useState<Set<string>>(new Set());
  const [powerupsUsed, setPowerupsUsed] = useState<string[]>([]);
  const [puTargets, setPuTargets] = useState<Record<string, string>>({
    sabotage: '', double_points: '', fake_hint: '', final_frenzy: 'all',
  });
  const [puMessages, setPuMessages] = useState('');
  const [puLoading, setPuLoading] = useState<string | null>(null);
  // Time Bomb
  const [hotPotatoMissionId, setHotPotatoMissionId] = useState('');
  const [hotPotatoLoading, setHotPotatoLoading] = useState(false);
  const [hotPotatoActive, setHotPotatoActive] = useState<HotPotatoState>(null);

  const [authToken, setAuthToken] = useState<string | null>(null);
  // Ref so closures (polling interval, startOrStop) always read the latest token
  // without needing to be in useCallback/useEffect dependency arrays.
  const authTokenRef = useRef<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [plan, setPlan] = useState<'free' | 'pro' | 'studio'>('free');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  // Analytics state
  type AnalyticsGame = { id: string; name: string | null; teamCount: number; topScore: number; finished: boolean; startedAt: string | null };
  type AnalyticsCustomer = { id: string; email: string; gameCount: number; avgTeams: number; completionRate: number; lastActive: string | null; games: AnalyticsGame[] };
  type AnalyticsMissionStat = { id: string; name: string; gameCount: number; completedCount: number; totalTeams: number; completionRate: number };
  type AnalyticsKPIs = { totalGames: number; finishedGames: number; activeCustomers: number; activeCustomers30d: number; completionRate: number; avgTeamsPerGame: number; totalTeams: number };
  type AnalyticsData = { kpis: AnalyticsKPIs; customers: AnalyticsCustomer[]; missionStats: AnalyticsMissionStat[] };

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [adminCustomMissions, setAdminCustomMissions] = useState<import('@/lib/supabase').CustomMission[]>([]);
  const [customCategoryName, setCustomCategoryName] = useState('My Missions');
  const [categoryNameSaving, setCategoryNameSaving] = useState(false);
  const [showMissionForm, setShowMissionForm] = useState(false);
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null);
  const [missionForm, setMissionForm] = useState<MissionFormData>(EMPTY_FORM);
  const [missionFormError, setMissionFormError] = useState('');
  const [missionSaving, setMissionSaving] = useState(false);
  const [deletingMissionId, setDeletingMissionId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: string; msg: string; type: 'success' | 'error' }[]>([]);

  // Load auth token on mount and subscribe to changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token ?? null;
      authTokenRef.current = token;
      setAuthToken(token);
      // Load subscription plan once we have a token
      if (token) {
        fetch('/api/admin/subscription', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        }).then(r => r.json()).then(d => { if (d.plan) setPlan(d.plan); }).catch(() => {});
      }
    });
    // Use getUser() for fresh server-side data (not cached JWT)
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSuperAdmin(user?.app_metadata?.role === 'superadmin');
      loadAdminCustomMissions();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      authTokenRef.current = token;
      setAuthToken(token);
      setIsSuperAdmin(session?.user?.app_metadata?.role === 'superadmin');
    });
    return () => subscription.unsubscribe();
  }, []);

  // Create form state
  const [gameName, setGameName] = useState('');
  const [duration, setDuration] = useState(45);
  const [selectedMissions, setSelectedMissions] = useState<string[]>(MISSIONS.map(m => m.id));
  const [missionMaxPts, setMissionMaxPts] = useState<Record<string, number>>(
    Object.fromEntries(MISSIONS.map(m => [m.id, m.maxPts]))
  );
  const [hideLeaderboard, setHideLeaderboard] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Timestamp of the last admin command (start/finish/restart).
  // Polls that started BEFORE a command are discarded to prevent race conditions.
  const lastCommandAtRef = useRef(0);

  const POST = useCallback((url: string, body?: object) => fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  }), [authToken]);

  const loadGames = useCallback(async () => {
    const res = await POST('/api/admin/game', { action: 'list' });
    const data = await res.json();
    if (data.games) setGames(data.games);
  }, [POST]);

  const loadGameData = useCallback(async (game: Game) => {
    const [teamsRes, photosRes, scavengerRes, gameRes, settingsRes] = await Promise.all([
      POST('/api/admin/teams', { gameId: game.id }),
      POST('/api/admin/photos'),
      POST('/api/scavenger/submissions'),
      POST('/api/game', { key: game.game_key }),
      POST('/api/settings', { gameId: game.id }),
    ]);
    const [td, pd, scvd, gd, sd] = await Promise.all([
      teamsRes.json(), photosRes.json(), scavengerRes.json(), gameRes.json(), settingsRes.json(),
    ]);
    if (td.teams) setTeams(td.teams);
    if (pd.submissions) setPhotos(pd.submissions.filter((s: PhotoSubmission) =>
      td.teams?.some((t: Team) => t.id === s.team_id)
    ));
    if (scvd.submissions) setScavengerSubs(scvd.submissions.filter((s: ScavengerSubmission) =>
      td.teams?.some((t: Team) => t.id === s.team_id)
    ));
    if (gd.game) {
      const STATUS_ORDER: Record<string, number> = { draft: 0, active: 1, finished: 2 };
      setActiveGame(prev => {
        if (!prev) return gd.game;
        return (STATUS_ORDER[gd.game.status] ?? 0) >= (STATUS_ORDER[prev.status] ?? 0) ? gd.game : prev;
      });
    }
    if (sd.powerups_used) setPowerupsUsed(sd.powerups_used);
    setHotPotatoActive(sd.hot_potato ?? null);
  }, [POST]);

  useEffect(() => { loadGames(); }, [loadGames]);

  // Only restart the polling interval when the game ID changes (not when game data updates).
  // Using activeGame?.id prevents an infinite loop where setActiveGame → effect re-runs → setActiveGame…
  const activeGameId = activeGame?.id;
  const activeGameKey = activeGame?.game_key;
  useEffect(() => {
    if (!activeGameId || !activeGameKey) return;
    // Snapshot id/key so the interval closure is stable
    const gameId = activeGameId;
    const gameKey = activeGameKey;
    // Status priority: draft(0) < active(1) < finished(2)
    // Never allow polling to downgrade status (fixes race between poll and startOrStop)
    const STATUS_ORDER: Record<string, number> = { draft: 0, active: 1, finished: 2 };
    function applyGame(fetched: Game) {
      setActiveGame(prev => {
        if (!prev) return fetched;
        const prevLevel = STATUS_ORDER[prev.status] ?? 0;
        const newLevel = STATUS_ORDER[fetched.status] ?? 0;
        // Allow upgrades (draft→active, active→finished) but never downgrades
        return newLevel >= prevLevel ? fetched : prev;
      });
    }

    // Helper that always reads the latest token from the ref — avoids stale closure bug
    // when the interval is set up before getSession() resolves.
    function postWithAuth(url: string, body?: object) {
      const token = authTokenRef.current;
      return fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body ?? {}),
        cache: 'no-store',
      });
    }

    async function poll() {
      const pollStartedAt = Date.now();

      const [teamsRes, photosRes, scavengerRes, gameRes, settingsRes] = await Promise.all([
        postWithAuth('/api/admin/teams', { gameId }),
        postWithAuth('/api/admin/photos'),
        postWithAuth('/api/scavenger/submissions'),
        postWithAuth('/api/game', { key: gameKey }),
        postWithAuth('/api/settings', { gameId }),
      ]);
      const [td, pd, scvd, gd, sd] = await Promise.all([
        teamsRes.json(), photosRes.json(), scavengerRes.json(), gameRes.json(), settingsRes.json(),
      ]);

      if (pollStartedAt < lastCommandAtRef.current) return;

      if (td.teams) setTeams(td.teams);
      if (pd.submissions) setPhotos(pd.submissions.filter((s: PhotoSubmission) =>
        td.teams?.some((t: Team) => t.id === s.team_id)
      ));
      if (scvd.submissions) setScavengerSubs(scvd.submissions.filter((s: ScavengerSubmission) =>
        td.teams?.some((t: Team) => t.id === s.team_id)
      ));
      if (gd.game) applyGame(gd.game);
      if (sd.powerups_used) setPowerupsUsed(sd.powerups_used);

      const hp = sd.hot_potato ?? null;
      setHotPotatoActive(hp);

      // Auto-resolve expired hot potato
      if (hp && new Date(hp.expires_at) <= new Date()) {
        await postWithAuth('/api/admin/powerup/resolve-hot-potato', { gameId });
        // Refresh settings after resolution
        const freshSd = await postWithAuth('/api/settings', { gameId }).then(r => r.json());
        if (freshSd.powerups_used) setPowerupsUsed(freshSd.powerups_used);
        setHotPotatoActive(freshSd.hot_potato ?? null);
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGameId]);

  async function createGame() {
    if (!selectedMissions.length) { setCreateError('Select at least one mission.'); return; }
    setCreating(true); setCreateError('');
    // Only include custom pts that differ from the mission default
    const customPts: Record<string, number> = {};
    for (const id of selectedMissions) {
      const m = MISSIONS.find(x => x.id === id);
      if (m && missionMaxPts[id] !== m.maxPts) customPts[id] = missionMaxPts[id];
    }
    const res = await fetch('/api/admin/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}) },
      body: JSON.stringify({ name: gameName, missions: selectedMissions, duration_minutes: duration, mission_max_pts: customPts, hide_leaderboard: hideLeaderboard }),
    });
    const data = await res.json();
    if (!res.ok) { setCreateError(data.error); setCreating(false); return; }
    setActiveGame(data.game);
    setView('dashboard');
    setCreating(false);
    loadGames();
  }

  async function startOrStop(action: 'start' | 'finish' | 'restart') {
    if (!activeGame) return;
    // Stamp the command time BEFORE the fetch so any poll in-flight right now
    // (which started before this stamp) gets discarded when it returns.
    lastCommandAtRef.current = Date.now();
    const token = authTokenRef.current;
    const res = await fetch('/api/admin/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
      body: JSON.stringify({ gameId: activeGame.id, action }),
    });
    const data = await res.json();
    // Directly set the authoritative state returned by the command.
    // This intentionally bypasses applyGame so a restart can go from
    // finished → draft without the status-priority guard blocking it.
    if (data.game) setActiveGame(data.game);
  }

  async function downloadReport() {
    if (!activeGame || !authToken) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await fetch(`/api/admin/game/${activeGame.id}/report`, {
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[report] failed:', body);
        setReportError('Kunde inte generera rapporten. Försök igen.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeGame.name.replace(/\s+/g, '-')}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[report] network error:', err);
      setReportError('Nätverksfel. Kontrollera anslutningen och försök igen.');
    } finally {
      setReportLoading(false);
    }
  }

  async function deleteGame(gameId: string) {
    setDeletingId(gameId);
    await POST('/api/admin/game', { action: 'delete', gameId });
    setDeletingId(null);
    setConfirmDeleteId(null);
    await loadGames();
  }

  async function ratePhoto(sub: PhotoSubmission, pts: number) {
    await fetch('/api/admin/photos/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}) },
      body: JSON.stringify({ submissionId: sub.id, teamId: sub.team_id, missionId: sub.mission_id, points: pts }),
    });
    setRated(r => new Set([...r, sub.id]));
    if (activeGame) loadGameData(activeGame);
  }

  async function rateScavengerPhoto(sub: ScavengerSubmission, pts: number) {
    await fetch('/api/scavenger/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}) },
      body: JSON.stringify({ submissionId: sub.id, teamId: sub.team_id, missionId: sub.mission_id, itemLabel: sub.item_label, points: pts }),
    });
    setScavengerRated(r => new Set([...r, sub.id]));
    if (activeGame) loadGameData(activeGame);
  }

  async function activateHotPotato() {
    if (!hotPotatoMissionId || !activeGame) return;
    const mission = MISSIONS.find(m => m.id === hotPotatoMissionId);
    if (!mission) return;
    setHotPotatoLoading(true);
    try {
      const res = await POST('/api/admin/powerup', {
        type: 'hot_potato',
        missionId: hotPotatoMissionId,
        missionName: mission.name,
        gameId: activeGame.id,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        showToast(`Time Bomb failed: ${err.error ?? res.statusText}`, 'error');
        return;
      }
      const data = await res.json();
      setHotPotatoActive({ mission_id: hotPotatoMissionId, expires_at: data.expiresAt, penalty_pts: 500, game_id: activeGame.id });
      setHotPotatoMissionId('');
    } finally {
      setHotPotatoLoading(false);
    }
  }

  async function activatePowerup(type: string) {
    const targetTeamId = puTargets[type];
    const isBroadcast = type === 'final_frenzy' || targetTeamId === 'all';
    if (!targetTeamId && !isBroadcast) return;
    if (!isBroadcast && !targetTeamId) return;
    setPuLoading(type);
    try {
      const res = await POST('/api/admin/powerup', {
        type,
        targetTeamId: isBroadcast ? 'all' : targetTeamId,
        gameId: activeGame?.id,
        ...(type === 'fake_hint' ? { message: puMessages } : {}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        showToast(`Power-up failed: ${err.error ?? res.statusText}`, 'error');
        return;
      }
      const sd = await POST('/api/settings', { gameId: activeGame?.id }).then(r => r.json());
      if (sd.powerups_used) setPowerupsUsed(sd.powerups_used);
      showToast('Power-up activated ✓');
    } finally {
      setPuLoading(null);
    }
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try {
      const res = await POST('/api/admin/superadmin/analytics');
      const data = await res.json();
      if (data.kpis) setAnalytics(data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function handlePortal() {
    setPortalLoading(true);
    try {
      const res = await POST('/api/admin/portal');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast(data.error ?? 'Something went wrong. Please try again.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleUpgrade(targetPlan: 'pro' | 'studio') {
    setUpgradeLoading(true);
    try {
      const res = await POST('/api/stripe/checkout', { plan: targetPlan });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast(data.error ?? 'Something went wrong. Please try again.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      setUpgradeLoading(false);
    }
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }

  async function loadAdminCustomMissions() {
    const res = await fetch('/api/admin/custom-missions', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      },
      cache: 'no-store',
    });
    const data = await res.json();
    if (data.missions) {
      setAdminCustomMissions(data.missions);
      if (data.missions.length > 0) setCustomCategoryName(data.missions[0].category_name);
    }
  }

  // Sort: highest score first; if equal, earliest finish_time wins; unfinished last
  const sorted = [...teams].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const fa = a.finished_at ? new Date(a.finished_at).getTime() : Infinity;
    const fb = b.finished_at ? new Date(b.finished_at).getTime() : Infinity;
    return fa - fb;
  });

  // ── GAMES LIST ──
  if (view === 'games') return (
    <>
      <nav className="nav" style={{ position: 'relative' }}>
        <div className="nav-brand"><GameOnLogo size={22} /></div>
        <NavCenter game={null} />
        <div className="nav-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {plan === 'free' ? (
            <button
              className="btn btn-primary"
              style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.5px', background: 'linear-gradient(135deg, #7CBDD4, #4890aa)', color: '#0D1520', border: 'none', borderRadius: '8px', cursor: upgradeLoading ? 'not-allowed' : 'pointer', opacity: upgradeLoading ? 0.7 : 1, whiteSpace: 'nowrap' }}
              onClick={() => handleUpgrade('pro')}
              disabled={upgradeLoading}
            >
              {upgradeLoading ? '...' : '⚡ UPGRADE'}
            </button>
          ) : (
            <button
              className="btn btn-ghost"
              style={{ padding: '7px 14px', fontSize: '11px', fontWeight: 600, color: 'var(--accent)', border: '1px solid rgba(124,189,212,0.25)', borderRadius: '8px', cursor: portalLoading ? 'not-allowed' : 'pointer', opacity: portalLoading ? 0.7 : 1, whiteSpace: 'nowrap' }}
              onClick={handlePortal}
              disabled={portalLoading}
            >
              {portalLoading ? '...' : plan === 'studio' ? '✦ Studio' : '⚡ Pro'}
            </button>
          )}
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onLogout}>LOG OUT</button>
        </div>
      </nav>
      <div className="container fade-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 0 24px' }}>
          <h2>Your Games</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            {plan === 'free' ? (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px', color: '#7CBDD4', border: '1px solid rgba(124,189,212,0.3)' }} onClick={() => handleUpgrade('pro')} disabled={upgradeLoading}>🔒 My Missions (Pro)</button>
            ) : (
              <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { loadAdminCustomMissions(); setView('missions'); }}>✏️ My Missions</button>
            )}
            <button className="btn btn-primary" onClick={() => setView('create')}>+ NEW GAME</button>
          </div>
        </div>
        {plan === 'free' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'rgba(124,189,212,0.06)', border: '1px solid rgba(124,189,212,0.15)', borderRadius: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)', flex: 1 }}>
              <span style={{ color: '#DCE4EE', fontWeight: 700 }}>Starter plan</span> — max 5 teams per game · <span style={{ color: '#7CBDD4', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleUpgrade('pro')}>Upgrade to Pro →</span>
            </span>
          </div>
        )}
        {games.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: '80px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎮</div>
            <p>No games yet. Create your first game!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {games.map(g => {
              const statusColor = g.status === 'active' ? 'var(--accent3)' : g.status === 'finished' ? 'var(--muted)' : 'var(--gold)';
              const statusLabel = g.status === 'active' ? '🟢 Active' : g.status === 'finished' ? '⬛ Finished' : '🟡 Draft';
              const isConfirming = confirmDeleteId === g.id;
              const isDeleting = deletingId === g.id;
              return (
                <div key={g.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px', background: 'var(--card)', border: `1px solid ${isConfirming ? 'var(--accent2)' : 'var(--border)'}`, borderRadius: '12px', transition: 'all 0.2s' }}>
                  {/* Clickable info area */}
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { if (!isConfirming) { setActiveGame(g); setView('dashboard'); } }}>
                    <div style={{ fontWeight: 700, fontSize: '16px' }}>{g.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                      {g.missions.length} missions · {g.duration_minutes} min
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--border)', marginTop: '4px', letterSpacing: '0.5px' }}>
                      {g.started_at
                        ? `▶ ${new Date(g.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} at ${new Date(g.started_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                        : `Created ${new Date(g.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      }
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Sora', sans-serif", letterSpacing: '3px', fontSize: '18px', fontWeight: 700, color: 'var(--accent)' }}>{g.game_key}</div>
                  <div style={{ fontSize: '13px', color: statusColor, fontWeight: 700 }}>{statusLabel}</div>

                  {/* Delete / confirm */}
                  {isConfirming ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '12px', color: 'var(--accent2)', fontWeight: 600 }}>Delete?</span>
                      <button onClick={() => deleteGame(g.id)} disabled={isDeleting}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', background: 'var(--accent2)', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}>
                        {isDeleting ? '...' : 'YES'}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)}
                        style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontWeight: 700, fontSize: '12px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}>
                        NO
                      </button>
                    </div>
                  ) : (
                    <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(g.id); }}
                      title="Delete game"
                      style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>
                      🗑
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  // ── MY MISSIONS ──
  if (view === 'missions') {
    async function saveCategoryName() {
      if (!customCategoryName.trim()) return;
      setCategoryNameSaving(true);
      await POST('/api/admin/custom-missions/category', { category_name: customCategoryName.trim() });
      setCategoryNameSaving(false);
      loadAdminCustomMissions();
    }

    function openNewForm() {
      setEditingMissionId(null);
      setMissionForm(EMPTY_FORM);
      setMissionFormError('');
      setShowMissionForm(true);
    }

    function openEditForm(cm: import('@/lib/supabase').CustomMission) {
      setEditingMissionId(cm.id);
      const d = cm.data as Record<string, unknown>;
      setMissionForm({
        name: cm.name,
        icon: cm.icon,
        desc: cm.desc,
        difficulty: cm.difficulty,
        maxPts: cm.max_pts,
        type: cm.type,
        triviaRounds: cm.type === 'trivia_quiz' ? (d.rounds as MissionFormData['triviaRounds']) ?? [] : [],
        statements: cm.type === 'truefalse' ? (d.statements as MissionFormData['statements']) ?? [] : [],
        closestQuestions: cm.type === 'closest_wins'
          ? ((d.questions as { q: string; answer: number; unit: string; hint: string }[]) ?? []).map(q => ({ ...q, answer: String(q.answer) }))
          : [],
        clues: cm.type === 'pa_sparet' ? (d.clues as string[]) ?? [] : [],
        paAnswer: cm.type === 'pa_sparet' ? (d.answer as string) ?? '' : '',
        timelineItems: cm.type === 'timeline'
          ? ((d.items as { label: string; year: number }[]) ?? []).map(i => ({ label: i.label, year: String(i.year) }))
          : [],
        photoPrompt: cm.type === 'photo' ? (d.prompt as string) ?? '' : '',
      });
      setMissionFormError('');
      setShowMissionForm(true);
    }

    async function saveMission() {
      const { validateMissionData, buildMissionData } = await import('@/lib/custom-missions');
      const validationError = validateMissionData(missionForm.type, {
        triviaRounds: missionForm.triviaRounds,
        statements: missionForm.statements,
        closestQuestions: missionForm.closestQuestions,
        clues: missionForm.clues,
        paAnswer: missionForm.paAnswer,
        timelineItems: missionForm.timelineItems,
        photoPrompt: missionForm.photoPrompt,
      });
      if (validationError) { setMissionFormError(validationError); return; }

      setMissionSaving(true);
      setMissionFormError('');
      const data = buildMissionData(missionForm.type, {
        triviaRounds: missionForm.triviaRounds,
        statements: missionForm.statements,
        closestQuestions: missionForm.closestQuestions,
        clues: missionForm.clues,
        paAnswer: missionForm.paAnswer,
        timelineItems: missionForm.timelineItems,
        photoPrompt: missionForm.photoPrompt,
      });
      const payload = {
        category_name: customCategoryName,
        name: missionForm.name.trim(),
        icon: missionForm.icon || '⭐',
        desc: missionForm.desc,
        difficulty: missionForm.difficulty,
        max_pts: missionForm.maxPts,
        type: missionForm.type,
        data,
      };

      if (editingMissionId) {
        const res = await fetch(`/api/admin/custom-missions/${editingMissionId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setMissionFormError(err.error ?? 'Could not save mission. Try again.');
          setMissionSaving(false);
          return;
        }
      } else {
        const res = await POST('/api/admin/custom-missions', { ...payload, sort_order: adminCustomMissions.length });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          setMissionFormError(err.error ?? 'Could not save mission. Try again.');
          setMissionSaving(false);
          return;
        }
      }
      setMissionSaving(false);
      setShowMissionForm(false);
      setEditingMissionId(null);
      showToast('Mission saved ✓');
      loadAdminCustomMissions();
    }

    async function deleteMission(id: string) {
      setDeletingMissionId(id);
      await fetch(`/api/admin/custom-missions/${id}`, {
        method: 'DELETE',
        headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {},
      });
      setDeletingMissionId(null);
      loadAdminCustomMissions();
    }

    const setF = (patch: Partial<MissionFormData>) => setMissionForm(prev => ({ ...prev, ...patch }));
    const inputStyle = { width: '100%', padding: '8px 12px', fontSize: '13px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text)', fontFamily: "'Sora', sans-serif" };
    const labelStyle = { fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--muted)', display: 'block', marginBottom: '4px' };

    return (
      <>
        <nav className="nav">
          <div className="nav-brand"><GameOnLogo size={22} /></div>
          <NavCenter game={null} />
          <div className="nav-right">
            <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onLogout}>LOG OUT</button>
          </div>
        </nav>
        <div className="container fade-in">
          <div style={{ padding: '32px 0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => { setView('games'); setShowMissionForm(false); }}>← Back</button>
            <h2 style={{ margin: 0 }}>My Missions</h2>
          </div>

          {/* Category name */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>CATEGORY NAME (shown to teams)</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={customCategoryName}
                onChange={e => setCustomCategoryName(e.target.value)}
                placeholder="e.g. Volvo Cars"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '12px', flexShrink: 0 }}
                disabled={categoryNameSaving || !customCategoryName.trim()}
                onClick={saveCategoryName}
              >
                {categoryNameSaving ? '...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Mission list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {adminCustomMissions.length === 0 && !showMissionForm && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px', fontSize: '14px' }}>
                No missions yet. Add your first one below.
              </div>
            )}
            {adminCustomMissions.map(cm => (
              <div key={cm.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '22px' }}>{cm.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{cm.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{cm.type.replace('_', ' ')} · {cm.difficulty} · {cm.max_pts} pts</div>
                </div>
                <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => openEditForm(cm)}>Edit</button>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '6px 12px', fontSize: '11px', color: 'var(--accent3)' }}
                  disabled={deletingMissionId === cm.id}
                  onClick={() => deleteMission(cm.id)}
                >
                  {deletingMissionId === cm.id ? '...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>

          {/* Add / Edit form */}
          {!showMissionForm && (
            <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={openNewForm}>+ Add Mission</button>
          )}

          {showMissionForm && (
            <div className="card" style={{ marginBottom: '32px' }}>
              <h3 style={{ marginBottom: '20px', fontSize: '16px' }}>{editingMissionId ? 'Edit Mission' : 'New Mission'}</h3>

              {/* Base fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>NAME</label>
                  <input type="text" value={missionForm.name} onChange={e => setF({ name: e.target.value })} placeholder="Mission name" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>ICON</label>
                  <input type="text" value={missionForm.icon} onChange={e => setF({ icon: e.target.value })} placeholder="⭐" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label style={labelStyle}>DESCRIPTION</label>
                <input type="text" value={missionForm.desc} onChange={e => setF({ desc: e.target.value })} placeholder="What teams see before starting" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>DIFFICULTY</label>
                  <select value={missionForm.difficulty} onChange={e => setF({ difficulty: e.target.value as MissionFormData['difficulty'] })} style={inputStyle}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>MAX PTS</label>
                  <input type="number" value={missionForm.maxPts} min={0} max={9999} step={50} onChange={e => setF({ maxPts: Number(e.target.value) })} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>TYPE</label>
                  <select value={missionForm.type} onChange={e => setF({ type: e.target.value })} style={inputStyle}>
                    <option value="">Select type…</option>
                    <option value="trivia_quiz">Trivia Quiz</option>
                    <option value="truefalse">True / False</option>
                    <option value="closest_wins">Closest Wins</option>
                    <option value="pa_sparet">På Spåret</option>
                    <option value="timeline">Timeline</option>
                    <option value="photo">Photo</option>
                  </select>
                </div>
              </div>

              {/* ── Type-specific fields ── */}

              {missionForm.type === 'photo' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>WHAT SHOULD TEAMS PHOTOGRAPH?</label>
                  <input type="text" value={missionForm.photoPrompt} onChange={e => setF({ photoPrompt: e.target.value })} placeholder="e.g. A selfie in front of our logo" style={inputStyle} />
                </div>
              )}

              {missionForm.type === 'pa_sparet' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>CLUES (revealed one at a time, most points for first clue)</label>
                  {missionForm.clues.map((clue, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', alignSelf: 'center', width: '20px', flexShrink: 0 }}>{i + 1}.</span>
                      <input type="text" value={clue} onChange={e => { const c = [...missionForm.clues]; c[i] = e.target.value; setF({ clues: c }); }} placeholder={`Clue ${i + 1}`} style={{ ...inputStyle, flex: 1 }} />
                      <button onClick={() => setF({ clues: missionForm.clues.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px', marginBottom: '10px' }} onClick={() => setF({ clues: [...missionForm.clues, ''] })}>+ Add clue</button>
                  <label style={labelStyle}>ANSWER</label>
                  <input type="text" value={missionForm.paAnswer} onChange={e => setF({ paAnswer: e.target.value })} placeholder="The correct answer" style={inputStyle} />
                </div>
              )}

              {missionForm.type === 'truefalse' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>STATEMENTS</label>
                  {missionForm.statements.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <input type="text" value={s.text} onChange={e => { const arr = [...missionForm.statements]; arr[i] = { ...arr[i], text: e.target.value }; setF({ statements: arr }); }} placeholder="Statement text" style={{ ...inputStyle, flex: 1 }} />
                      <select value={s.answer ? 'true' : 'false'} onChange={e => { const arr = [...missionForm.statements]; arr[i] = { ...arr[i], answer: e.target.value === 'true' }; setF({ statements: arr }); }} style={{ ...inputStyle, width: '90px', flexShrink: 0 }}>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                      <button onClick={() => setF({ statements: missionForm.statements.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setF({ statements: [...missionForm.statements, { text: '', answer: true }] })}>+ Add statement</button>
                </div>
              )}

              {missionForm.type === 'closest_wins' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>QUESTIONS</label>
                  {missionForm.closestQuestions.map((q, i) => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Question {i + 1}</span>
                        <button onClick={() => setF({ closestQuestions: missionForm.closestQuestions.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px' }}>×</button>
                      </div>
                      <input type="text" value={q.q} onChange={e => { const arr = [...missionForm.closestQuestions]; arr[i] = { ...arr[i], q: e.target.value }; setF({ closestQuestions: arr }); }} placeholder="Question" style={{ ...inputStyle, marginBottom: '6px' }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <input type="number" value={q.answer} onChange={e => { const arr = [...missionForm.closestQuestions]; arr[i] = { ...arr[i], answer: e.target.value }; setF({ closestQuestions: arr }); }} placeholder="Correct answer (number)" style={inputStyle} />
                        <input type="text" value={q.unit} onChange={e => { const arr = [...missionForm.closestQuestions]; arr[i] = { ...arr[i], unit: e.target.value }; setF({ closestQuestions: arr }); }} placeholder="Unit (e.g. employees)" style={inputStyle} />
                      </div>
                      <input type="text" value={q.hint} onChange={e => { const arr = [...missionForm.closestQuestions]; arr[i] = { ...arr[i], hint: e.target.value }; setF({ closestQuestions: arr }); }} placeholder="Hint" style={{ ...inputStyle, marginTop: '6px' }} />
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setF({ closestQuestions: [...missionForm.closestQuestions, { q: '', answer: '', unit: '', hint: '' }] })}>+ Add question</button>
                </div>
              )}

              {missionForm.type === 'timeline' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>EVENTS (teams will sort these chronologically)</label>
                  {missionForm.timelineItems.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '6px', alignItems: 'center' }}>
                      <input type="text" value={item.label} onChange={e => { const arr = [...missionForm.timelineItems]; arr[i] = { ...arr[i], label: e.target.value }; setF({ timelineItems: arr }); }} placeholder="Event label" style={{ ...inputStyle, flex: 1 }} />
                      <input type="number" value={item.year} onChange={e => { const arr = [...missionForm.timelineItems]; arr[i] = { ...arr[i], year: e.target.value }; setF({ timelineItems: arr }); }} placeholder="Year" style={{ ...inputStyle, width: '90px', flexShrink: 0 }} />
                      <button onClick={() => setF({ timelineItems: missionForm.timelineItems.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '16px', flexShrink: 0 }}>×</button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setF({ timelineItems: [...missionForm.timelineItems, { label: '', year: '' }] })}>+ Add event</button>
                </div>
              )}

              {missionForm.type === 'trivia_quiz' && (
                <div style={{ marginBottom: '12px' }}>
                  <label style={labelStyle}>QUESTIONS</label>
                  {missionForm.triviaRounds.map((round, i) => (
                    <div key={i} style={{ background: 'var(--surface)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Question {i + 1}</span>
                        <button onClick={() => setF({ triviaRounds: missionForm.triviaRounds.filter((_, j) => j !== i) })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '14px' }}>×</button>
                      </div>
                      <input type="text" value={round.question} onChange={e => { const arr = [...missionForm.triviaRounds]; arr[i] = { ...arr[i], question: e.target.value }; setF({ triviaRounds: arr }); }} placeholder="Question" style={{ ...inputStyle, marginBottom: '8px' }} />
                      {([0, 1, 2, 3] as const).map(oi => (
                        <div key={oi} style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'center' }}>
                          <input
                            type="radio"
                            name={`correct-${i}`}
                            checked={round.answer === round.options[oi]}
                            onChange={() => { const arr = [...missionForm.triviaRounds]; arr[i] = { ...arr[i], answer: arr[i].options[oi] }; setF({ triviaRounds: arr }); }}
                            style={{ flexShrink: 0 }}
                          />
                          <input
                            type="text"
                            value={round.options[oi] ?? ''}
                            onChange={e => {
                              const arr = [...missionForm.triviaRounds];
                              const opts: [string, string, string, string] = [...arr[i].options] as [string, string, string, string];
                              opts[oi] = e.target.value;
                              const newAnswer = arr[i].answer === arr[i].options[oi] ? e.target.value : arr[i].answer;
                              arr[i] = { ...arr[i], options: opts, answer: newAnswer };
                              setF({ triviaRounds: arr });
                            }}
                            placeholder={`Option ${oi + 1}`}
                            style={{ ...inputStyle, flex: 1 }}
                          />
                        </div>
                      ))}
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '4px' }}>Select the radio button next to the correct option</div>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 10px' }} onClick={() => setF({ triviaRounds: [...missionForm.triviaRounds, { question: '', options: ['', '', '', ''], answer: '' }] })}>+ Add question</button>
                </div>
              )}

              {missionFormError && (
                <p style={{ color: 'var(--accent3)', fontSize: '13px', marginBottom: '12px' }}>{missionFormError}</p>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }} disabled={missionSaving || !missionForm.name.trim() || !missionForm.type} onClick={saveMission}>
                  {missionSaving ? 'Saving…' : editingMissionId ? 'Save Changes' : 'Add Mission'}
                </button>
                <button className="btn btn-ghost" style={{ padding: '10px 16px' }} onClick={() => { setShowMissionForm(false); setEditingMissionId(null); setMissionFormError(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // ── CREATE GAME ──
  if (view === 'create') return (
    <>
      <nav className="nav" style={{ position: 'relative' }}>
        <div className="nav-brand"><GameOnLogo size={22} /></div>
        <NavCenter game={null} />
        <div className="nav-right">
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => { loadGames(); setView('games'); }}>← BACK</button>
        </div>
      </nav>
      <div className="container fade-in" style={{ maxWidth: '720px' }}>
        <div style={{ padding: '32px 0 24px' }}>
          <h2>Create a New Game</h2>
          <p style={{ color: 'var(--muted)', marginTop: '6px', fontSize: '14px' }}>Configure the game and share the key with your teams.</p>
        </div>

        <div className="card" style={{ marginBottom: '24px' }}>
          <div className="form-group">
            <label className="form-label">Game Name (optional)</label>
            <input type="text" placeholder="E.g. IT Day 2026" value={gameName} onChange={e => setGameName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Duration: {duration} minutes</label>
            <input type="range" min={15} max={120} step={5} value={duration} onChange={e => setDuration(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
              <span>15 min</span><span>120 min</span>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div
              onClick={() => setHideLeaderboard(v => !v)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '12px 14px', background: 'var(--surface)', border: `1px solid ${hideLeaderboard ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '10px' }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)' }}>🙈 Hide leaderboard in last 5 min</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
                  Teams won&apos;t see the leaderboard in the last 5 minutes, and won&apos;t see final placements when the game ends.
                </div>
              </div>
              <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: hideLeaderboard ? 'var(--accent)' : 'var(--border)', position: 'relative', flexShrink: 0, marginLeft: '12px' }}>
                <div style={{ position: 'absolute', top: '2px', left: hideLeaderboard ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <label className="form-label" style={{ margin: 0 }}>Select Missions ({selectedMissions.length} selected)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setSelectedMissions(MISSIONS.map(m => m.id))}>All on</button>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setSelectedMissions([])}>All off</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {(Object.keys(SUPER_CATEGORIES) as SuperCategoryKey[]).map(catKey => {
              if (catKey === 'gkn' && !isSuperAdmin) return null;
              const cat = SUPER_CATEGORIES[catKey];
              const catMissions = MISSIONS.filter(m => MISSION_SUPER_CATEGORY[m.id] === catKey);
              if (catMissions.length === 0) return null;
              const allOn = catMissions.every(m => selectedMissions.includes(m.id));
              return (
                <div key={catKey}>
                  {/* Category header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', color: cat.color }}>
                      {cat.icon} {cat.label.toUpperCase()}
                    </span>
                    <button
                      onClick={() => {
                        const ids = catMissions.map(m => m.id);
                        setSelectedMissions(prev => allOn
                          ? prev.filter(x => !ids.includes(x))
                          : [...new Set([...prev, ...ids])]);
                      }}
                      style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                    >
                      {allOn ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {catMissions.map(m => {
                      const on = selectedMissions.includes(m.id);
                      const pts = missionMaxPts[m.id] ?? m.maxPts;
                      const isCustom = pts !== m.maxPts;
                      return (
                        <div key={m.id} style={{ background: 'var(--card)', border: `1px solid ${on ? cat.color : 'var(--border)'}`, borderRadius: '8px', opacity: on ? 1 : 0.45, overflow: 'hidden' }}>
                          <div onClick={() => setSelectedMissions(prev => on ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                            style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px', cursor: 'pointer' }}>
                            <span style={{ fontSize: '18px' }}>{m.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: '13px' }}>{m.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.difficulty} · {m.maxPts} pts</div>
                            </div>
                            <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: on ? cat.color : 'var(--border)', position: 'relative', flexShrink: 0 }}>
                              <div style={{ position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                            </div>
                          </div>
                          {on && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 14px 10px', borderTop: '1px solid var(--border)' }}
                              onClick={e => e.stopPropagation()}>
                              <span style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1px', flexShrink: 0 }}>MAX PTS</span>
                              <input
                                type="number" min={0} max={9999} step={50} value={pts}
                                onChange={e => setMissionMaxPts(prev => ({ ...prev, [m.id]: Math.max(0, Number(e.target.value)) }))}
                                style={{ width: '90px', padding: '4px 8px', fontSize: '13px', fontWeight: 700, fontFamily: "'Sora', sans-serif", background: 'var(--surface)', border: `1px solid ${isCustom ? cat.color : 'var(--border)'}`, borderRadius: '6px', color: isCustom ? cat.color : 'var(--text)' }}
                              />
                              {isCustom
                                ? <button onClick={() => setMissionMaxPts(prev => ({ ...prev, [m.id]: m.maxPts }))} style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', fontFamily: "'Sora', sans-serif" }}>reset</button>
                                : <span style={{ fontSize: '11px', color: 'var(--muted)' }}>default</span>
                              }
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {/* ── Custom missions ── */}
            {adminCustomMissions.length > 0 && (() => {
              const catName = adminCustomMissions[0].category_name;
              const allOn = adminCustomMissions.every(m => selectedMissions.includes(m.id));
              return (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1.5px', color: '#9b59b6' }}>
                      ⭐ {catName.toUpperCase()}
                    </span>
                    <button
                      onClick={() => {
                        const ids = adminCustomMissions.map(m => m.id);
                        setSelectedMissions(prev => allOn
                          ? prev.filter(x => !ids.includes(x))
                          : [...new Set([...prev, ...ids])]);
                      }}
                      style={{ fontSize: '11px', color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}
                    >
                      {allOn ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {adminCustomMissions.map(m => {
                      const on = selectedMissions.includes(m.id);
                      const pts = missionMaxPts[m.id] ?? m.max_pts;
                      return (
                        <div key={m.id} style={{ background: 'var(--card)', border: `1px solid ${on ? '#9b59b6' : 'var(--border)'}`, borderRadius: '8px', opacity: on ? 1 : 0.45 }}>
                          <div
                            onClick={() => {
                              setSelectedMissions(prev => on ? prev.filter(x => x !== m.id) : [...prev, m.id]);
                              if (!missionMaxPts[m.id]) setMissionMaxPts(prev => ({ ...prev, [m.id]: m.max_pts }));
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 14px', cursor: 'pointer' }}
                          >
                            <span style={{ fontSize: '18px' }}>{m.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: '13px' }}>{m.name}</div>
                              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.difficulty} · {m.max_pts} pts</div>
                            </div>
                            <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: on ? '#9b59b6' : 'var(--border)', position: 'relative', flexShrink: 0 }}>
                              <div style={{ position: 'absolute', top: '2px', left: on ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {createError && <p style={{ color: 'var(--accent2)', fontSize: '13px', marginBottom: '12px' }}>{createError}</p>}
        <button className="btn btn-primary btn-full" onClick={createGame} disabled={creating}>
          {creating ? 'CREATING...' : '🎮 CREATE GAME →'}
        </button>
      </div>
    </>
  );

  // ── GAME DASHBOARD ──
  if (!activeGame) return null;
  const pendingPhotos = photos.filter(s => s.status === 'pending' && !rated.has(s.id));
  const pendingScavenger = scavengerSubs.filter(s => s.status === 'pending' && !scavengerRated.has(s.id));
  const totalPendingPhotos = pendingPhotos.length + pendingScavenger.length;

  return (
    <>
      <nav className="nav" style={{ position: 'relative' }}>
        <div className="nav-brand"><GameOnLogo size={22} /></div>
        <NavCenter game={activeGame} />
        <div className="nav-right">
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => { loadGames(); setTeams([]); setPhotos([]); setView('games'); }}>← GAMES</button>
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onLogout}>LOG OUT</button>
        </div>
      </nav>

      <div className="container fade-in" style={{ paddingBottom: isMobile ? '80px' : undefined }}>
        {/* GAME KEY + QR + START */}
        <div style={{ padding: '28px 0 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* QR code — click to expand */}
            <div
              onClick={() => setQrExpanded(true)}
              title="Click to enlarge"
              style={{ background: '#fff', borderRadius: '12px', padding: '10px', flexShrink: 0, cursor: 'zoom-in', position: 'relative' }}
            >
              <QRCodeSVG
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?key=${activeGame.game_key}`}
                size={100}
                bgColor="#ffffff"
                fgColor="#0f1724"
                level="M"
              />
              <div style={{ position: 'absolute', bottom: '4px', right: '6px', fontSize: '10px', color: '#aaa' }}>🔍</div>
            </div>

            {/* QR expanded modal */}
            {qrExpanded && (
              <div
                onClick={() => setQrExpanded(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px', padding: '32px' }}
              >
                <div style={{ background: '#fff', borderRadius: '20px', padding: '24px' }}>
                  <QRCodeSVG
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?key=${activeGame.game_key}`}
                    size={280}
                    bgColor="#ffffff"
                    fgColor="#0f1724"
                    level="M"
                  />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '36px', fontWeight: 700, color: '#fff', letterSpacing: '8px', marginBottom: '8px' }}>
                    {activeGame.game_key}
                  </div>
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>Tap anywhere to close</p>
                </div>
              </div>
            )}
            {/* Photo fullscreen modal */}
            {photoModal && (
              <div
                onClick={() => setPhotoModal(null)}
                style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '24px' }}
              >
                <img
                  src={photoModal.url}
                  alt={photoModal.label}
                  style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '12px', objectFit: 'contain', boxShadow: '0 8px 48px rgba(0,0,0,0.6)' }}
                  onClick={e => e.stopPropagation()}
                />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#fff' }}>{photoModal.label}</div>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>Tap anywhere to close</p>
                </div>
              </div>
            )}

            {/* Key + status */}
            <div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '6px' }}>GAME KEY — share with teams</p>
              <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '48px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '8px', lineHeight: 1 }}>
                {activeGame.game_key}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>
                {activeGame.missions.length} missions · {activeGame.duration_minutes} min ·{' '}
                <span style={{ color: activeGame.status === 'active' ? 'var(--accent3)' : activeGame.status === 'finished' ? 'var(--muted)' : 'var(--gold)', fontWeight: 700 }}>
                  {activeGame.status === 'active' ? '🟢 Running' : activeGame.status === 'finished' ? '⬛ Finished' : '🟡 Draft'}
                </span>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {activeGame.status === 'draft' && (
              <button className="btn btn-primary" onClick={() => startOrStop('start')} style={{ fontSize: '15px', padding: '14px 28px' }}>
                ▶ START GAME
              </button>
            )}
            {activeGame.status === 'active' && (
              <button className="btn btn-danger" onClick={() => startOrStop('finish')} style={{ fontSize: '13px', padding: '12px 20px' }}>
                ⏹ END GAME
              </button>
            )}
            {(activeGame.status === 'finished' || activeGame.status === 'active') && (
              <button className="btn btn-ghost" onClick={() => startOrStop('restart')}
                style={{ fontSize: '13px', padding: '12px 20px', border: '1px solid var(--border)' }}
                title="Reset game to Draft so you can start it again">
                ↺ RESTART
              </button>
            )}
            {activeGame.status === 'finished' && (
              <>
                {plan === 'free' ? (
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleUpgrade('pro')}
                    disabled={upgradeLoading}
                    title="Upgrade to Pro to download PDF reports"
                    style={{ fontSize: '13px', padding: '12px 20px', border: '1px solid rgba(124,189,212,0.3)', color: '#7CBDD4' }}
                  >
                    🔒 Download Report (Pro)
                  </button>
                ) : (
                  <button
                    className="btn btn-ghost"
                    disabled={reportLoading}
                    onClick={downloadReport}
                    style={{ fontSize: '13px', padding: '12px 20px', border: '1px solid var(--border)' }}
                  >
                    {reportLoading ? '⏳ Generating…' : '📄 Download Report'}
                  </button>
                )}
                {reportError && (
                  <p style={{ color: 'var(--danger, #e74c3c)', fontSize: '12px', margin: '4px 0 0' }}>
                    {reportError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* TABS */}
        <div className="admin-tabs">
          <button className={`admin-tab${tab === 'leaderboard' ? ' active' : ''}`} onClick={() => setTab('leaderboard')}>🏆 Scores</button>
          <button className={`admin-tab${tab === 'progress' ? ' active' : ''}`} onClick={() => setTab('progress')}>📊 Progress</button>
          <button className={`admin-tab${tab === 'photos' ? ' active' : ''}`} onClick={() => setTab('photos')} style={{ position: 'relative' }}>
            📸 Photos
            {totalPendingPhotos > 0 && (
              <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--accent2)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {totalPendingPhotos}
              </span>
            )}
          </button>
          <button className={`admin-tab${tab === 'stats' ? ' active' : ''}`} onClick={() => setTab('stats')}>📈 Stats</button>
          {activeGame.status === 'active' && (
            <button className={`admin-tab${tab === 'powerups' ? ' active' : ''}`} onClick={() => setTab('powerups')}>⚡ Power-ups{plan === 'free' ? ' 🔒' : ''}</button>
          )}
          {isSuperAdmin && (
            <button className={`admin-tab${tab === 'customers' ? ' active' : ''}`} onClick={() => { setTab('customers'); loadAnalytics(); }}>📊 Analytics</button>
          )}
        </div>

        {/* LEADERBOARD */}
        {tab === 'leaderboard' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Leaderboard</h2>
              <span className="badge">{teams.length} teams</span>
            </div>
            <div className="leaderboard">
              {sorted.length === 0 ? <div className="empty-state">No teams yet.</div> : sorted.map((t, i) => {
                const finishElapsed = t.finished_at && activeGame.started_at
                  ? fmtElapsed(new Date(t.finished_at).getTime() - new Date(activeGame.started_at).getTime())
                  : null;
                return (
                  <div className="lb-row" key={t.id}>
                    <div className="lb-rank" style={{ color: RANK_COLORS[i] ?? 'var(--muted)' }}>{RANK_ICONS[i] ?? i + 1}</div>
                    <div className="lb-name">{t.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', marginLeft: 'auto' }}>
                      <div className="lb-score">{t.score} p</div>
                      {finishElapsed ? (
                        <div style={{ fontSize: '11px', color: 'var(--accent3)', letterSpacing: '0.5px' }}>🏁 {finishElapsed}</div>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{t.completed?.length ?? 0}/{activeGame.missions.length} done</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PROGRESS */}
        {tab === 'progress' && (() => {
          // Group active missions by super-category
          const catGroups = (Object.keys(SUPER_CATEGORIES) as SuperCategoryKey[]).map(catKey => ({
            catKey,
            cat: SUPER_CATEGORIES[catKey],
            missions: activeGame.missions
              .map(id => MISSIONS.find(x => x.id === id))
              .filter((m): m is NonNullable<typeof m> => !!m && MISSION_SUPER_CATEGORY[m.id] === catKey),
          })).filter(g => g.missions.length > 0);

          return (
            <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {catGroups.map(({ catKey, cat, missions }) => (
                <div key={catKey}>
                  {/* Category header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                    <span style={{ fontWeight: 800, fontSize: '13px', color: cat.color, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{cat.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '4px' }}>{missions.length} mission{missions.length !== 1 ? 's' : ''}</span>
                  </div>
                  {/* Table for this category */}
                  <div style={{ background: 'var(--card)', border: `1px solid ${cat.color}33`, borderRadius: '12px', overflow: 'auto' }}>
                    <table className="progress-table">
                      <thead>
                        <tr>
                          <th>Team</th>
                          {missions.map(m => (
                            <th key={m.id} title={m.name}>{m.icon}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.length === 0 ? (
                          <tr><td colSpan={missions.length + 1} style={{ textAlign: 'center', padding: '24px', color: 'var(--muted)', fontSize: '12px' }}>Waiting for teams...</td></tr>
                        ) : sorted.map(t => (
                          <tr key={t.id}>
                            <td><strong>{t.name}</strong></td>
                            {missions.map(m => {
                              const done = t.completed?.includes(m.id);
                              const pts = done ? (t.mission_scores?.[m.id] ?? null) : null;
                              return (
                                <td key={m.id}>
                                  {done
                                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: cat.color, fontWeight: 700, fontSize: '12px' }}>
                                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: cat.color, display: 'inline-block', flexShrink: 0 }} />
                                        {pts !== null ? pts : '✓'}
                                      </span>
                                    : <span style={{ color: 'var(--muted)' }}>–</span>
                                  }
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Total score summary */}
              {sorted.length > 0 && (
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', fontWeight: 800, fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    Total Score
                  </div>
                  <table className="progress-table">
                    <tbody>
                      {sorted.map(t => (
                        <tr key={t.id}>
                          <td><strong>{t.name}</strong></td>
                          <td className="pts-cell" style={{ textAlign: 'right' }}>{t.score} p</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })()}

        {/* PHOTOS */}
        {tab === 'photos' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Photo Submissions</h2>
              <span className="badge">{pendingPhotos.length} pending</span>
            </div>

            {/* Team filter */}
            {teams.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <select
                  value={photoTeamFilter}
                  onChange={e => { setPhotoTeamFilter(e.target.value); setVisiblePendingCount(10); setVisibleScavengerCount(10); setVisibleRatedCount(20); }}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: "'Sora', sans-serif", fontSize: '13px', width: '100%', cursor: 'pointer' }}
                >
                  <option value="all">All teams</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {photos.filter(s => photoTeamFilter === 'all' || s.team_id === photoTeamFilter).length === 0 &&
             scavengerSubs.filter(s => photoTeamFilter === 'all' || s.team_id === photoTeamFilter).length === 0
              ? <div className="empty-state">No photos submitted yet.</div>
              : null}

            {/* Pending regular photos */}
            {(() => {
              const pendingFiltered = photos.filter(s => s.status !== 'rated' && !rated.has(s.id) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter));
              return pendingFiltered.length > 0 && (
              <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {pendingFiltered.slice(0, visiblePendingCount).map(sub => {
                  const mission = MISSIONS.find(m => m.id === sub.mission_id);
                  const missionMaxPts = activeGame.mission_max_pts?.[sub.mission_id] ?? mission?.maxPts ?? 500;
                  const pointOptions = getPointOptions(missionMaxPts);
                  return (
                    <div key={sub.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>{mission?.icon ?? '📸'}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mission?.name ?? sub.mission_id}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{sub.team_name}</div>
                        </div>
                      </div>
                      <div
                        style={{ height: '200px', overflow: 'hidden', flexShrink: 0, cursor: 'zoom-in' }}
                        onClick={() => setPhotoModal({ url: sub.photo_url, label: `${sub.team_name} — ${mission?.name ?? sub.mission_id}` })}
                      >
                        <img src={sub.photo_url} alt={sub.team_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                      <div style={{ padding: '10px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {pointOptions.map(pts => (
                          <button key={pts} onClick={() => ratePhoto(sub, pts)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: pts === missionMaxPts ? 'rgba(222,187,107,0.15)' : pts === 0 ? 'rgba(208,117,125,0.10)' : 'var(--surface)', color: pts === missionMaxPts ? 'var(--gold)' : pts === 0 ? 'var(--accent2)' : 'var(--text)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '12px' }}>
                            {pts}p
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {pendingFiltered.length > visiblePendingCount && (
                <button onClick={() => setVisiblePendingCount(n => n + 10)}
                  style={{ marginTop: '16px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: '13px' }}>
                  Visa 10 till ({pendingFiltered.length - visiblePendingCount} kvar)
                </button>
              )}
              </>
              );
            })()}

            {/* Pending scavenger photos */}
            {(() => {
              const scavFiltered = scavengerSubs.filter(s => s.status !== 'rated' && !scavengerRated.has(s.id) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter));
              return scavFiltered.length > 0 && (
              <>
                <div className="section-header" style={{ marginTop: '32px' }}>
                  <h2 style={{ fontSize: '18px' }}>📍 Scavenger Hunt</h2>
                  <span className="badge">{scavFiltered.length} pending</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                  {scavFiltered.slice(0, visibleScavengerCount).map(sub => (
                    <div key={sub.id} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>📍</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.item_label}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{sub.team_name}</div>
                        </div>
                      </div>
                      <div
                        style={{ height: '180px', overflow: 'hidden', flexShrink: 0, cursor: 'zoom-in' }}
                        onClick={() => setPhotoModal({ url: sub.photo_url, label: `${sub.team_name} — ${sub.item_label}` })}
                      >
                        <img src={sub.photo_url} alt={sub.item_label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                      <div style={{ padding: '10px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[0, 25, 50, 75, 100].map(pts => (
                          <button key={pts} onClick={() => rateScavengerPhoto(sub, pts)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: pts === 100 ? 'rgba(222,187,107,0.15)' : pts === 0 ? 'rgba(208,117,125,0.10)' : 'var(--surface)', color: pts === 100 ? 'var(--gold)' : pts === 0 ? 'var(--accent2)' : 'var(--text)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '12px' }}>
                            {pts}p
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {scavFiltered.length > visibleScavengerCount && (
                  <button onClick={() => setVisibleScavengerCount(n => n + 10)}
                    style={{ marginTop: '16px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: '13px' }}>
                    Visa 10 till ({scavFiltered.length - visibleScavengerCount} kvar)
                  </button>
                )}
              </>
              );
            })()}

            {/* Rated archive — regular + scavenger combined */}
            {(() => {
              const ratedRegular = photos.filter(s => (s.status === 'rated' || rated.has(s.id)) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter));
              const ratedScav = scavengerSubs.filter(s => (s.status === 'rated' || scavengerRated.has(s.id)) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter));
              const allRated = [...ratedRegular.map(s => ({ ...s, _type: 'regular' as const })), ...ratedScav.map(s => ({ ...s, _type: 'scavenger' as const }))];
              return allRated.length > 0 && (
              <>
                <div className="section-header" style={{ marginTop: '28px' }}>
                  <h2 style={{ fontSize: '16px', color: 'var(--muted)' }}>✓ Rated</h2>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{allRated.length} photos</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', opacity: 0.7 }}>
                  {allRated.slice(0, visibleRatedCount).map(sub => {
                    if (sub._type === 'regular') {
                      const mission = MISSIONS.find(m => m.id === (sub as typeof ratedRegular[0]).mission_id);
                      return (
                        <div key={sub.id} style={{ background: 'var(--card)', border: '1px solid var(--accent3)', borderRadius: '12px', overflow: 'hidden' }}>
                          <div style={{ padding: '6px 10px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px' }}>{mission?.icon ?? '📸'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.team_name}</div>
                            </div>
                            <span style={{ color: 'var(--accent3)', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>✓ {(sub as typeof ratedRegular[0]).points_awarded ?? 0}p</span>
                          </div>
                          <div style={{ height: '140px', overflow: 'hidden', cursor: 'zoom-in' }}
                            onClick={() => setPhotoModal({ url: sub.photo_url, label: `${sub.team_name} — ${mission?.name ?? (sub as typeof ratedRegular[0]).mission_id}` })}>
                            <img src={sub.photo_url} alt={sub.team_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          </div>
                        </div>
                      );
                    } else {
                      const s = sub as typeof ratedScav[0];
                      return (
                        <div key={sub.id} style={{ background: 'var(--card)', border: '1px solid var(--accent3)', borderRadius: '12px', overflow: 'hidden' }}>
                          <div style={{ padding: '6px 10px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '12px' }}>📍</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.team_name}</div>
                            </div>
                            <span style={{ color: 'var(--accent3)', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>✓ {s.points_awarded ?? 0}p</span>
                          </div>
                          <div style={{ height: '140px', overflow: 'hidden', cursor: 'zoom-in' }}
                            onClick={() => setPhotoModal({ url: sub.photo_url, label: `${sub.team_name} — ${s.item_label}` })}>
                            <img src={sub.photo_url} alt={s.item_label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
                {allRated.length > visibleRatedCount && (
                  <button onClick={() => setVisibleRatedCount(n => n + 20)}
                    style={{ marginTop: '16px', width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontSize: '13px' }}>
                    Visa 20 till ({allRated.length - visibleRatedCount} kvar)
                  </button>
                )}
              </>
              );
            })()}
          </div>
        )}

        {/* STATS */}
        {tab === 'stats' && (() => {
          const gameMissions = (activeGame.missions ?? [])
            .map(id => MISSIONS.find(m => m.id === id))
            .filter(Boolean) as typeof MISSIONS;

          // 1. Mission completion — top 10
          const completionStats = gameMissions
            .map(m => ({ m, value: teams.filter(t => t.completed?.includes(m.id)).length }))
            .filter(x => x.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

          // 2. Total points per mission — top 10
          const pointStats = gameMissions
            .map(m => ({ m, value: teams.reduce((s, t) => s + (t.mission_scores?.[m.id] ?? 0), 0) }))
            .filter(x => x.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

          // 3. Would You answers
          const wouldYouMissions = gameMissions.filter(m => m.type === 'wouldyou');
          const wouldYouAnswers = wouldYouMissions.map(m => ({
            m,
            answers: teams
              .filter(t => t.mission_answers?.[m.id])
              .map(t => ({ team: t.name, answer: t.mission_answers[m.id] })),
          })).filter(x => x.answers.length > 0);

          // 4. Duel stolen — top 3
          const duelStats = teams
            .map(t => ({ name: t.name, value: t.mission_scores?.['duel_trivia'] ?? 0 }))
            .filter(x => x.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 3);

          // 5. Most targeted by other teams (powerups_received) — top 3
          const puTargetStats = teams
            .map(t => ({ name: t.name, value: t.powerups_received ?? 0 }))
            .filter(x => x.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 3);

          const statCard = (children: React.ReactNode) => (
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
              {children}
            </div>
          );

          const statTitle = (icon: string, label: string) => (
            <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--muted)', letterSpacing: '1px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{icon}</span>{label}
            </div>
          );

          // Vertical bar chart with mission on X-axis
          const BarChart = ({ data, maxValue, color, unit }: {
            data: { m: typeof MISSIONS[0]; value: number }[];
            maxValue: number;
            color: string;
            unit: string;
          }) => (
            <div style={{ overflowX: 'auto', paddingBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', minWidth: 'max-content' }}>
                {data.map(({ m, value }) => {
                  const barH = maxValue > 0 ? Math.max(4, Math.round((value / maxValue) * 96)) : 4;
                  return (
                    <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '58px', gap: '3px' }}>
                      {/* Fixed-height bar area — all bars share the same 116px container */}
                      <div style={{ height: '116px', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: '3px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, color, lineHeight: 1 }}>{value}{unit}</span>
                        <div style={{ width: '100%', height: `${barH}px`, background: color, borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
                      </div>
                      {/* Baseline */}
                      <div style={{ width: '100%', height: '1px', background: 'var(--border)' }} />
                      {/* Labels below — don't affect bar height */}
                      <span style={{ fontSize: '18px', lineHeight: 1 }}>{m.icon}</span>
                      <span style={{ fontSize: '9px', color: 'var(--muted)', textAlign: 'center', lineHeight: 1.2, maxWidth: '58px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {m.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );

          const top3Medal = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';

          return (
            <div className="fade-in">
              <div className="section-header">
                <h2 style={{ fontSize: '18px' }}>Statistics</h2>
                <span className="badge">{teams.length} teams</span>
              </div>

              {/* 1. Mission completion bar chart */}
              {statCard(<>
                {statTitle('🏆', 'MOST COMPLETED MISSIONS (TOP 10)')}
                {completionStats.length === 0
                  ? <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No completions yet.</div>
                  : <BarChart data={completionStats} maxValue={teams.length} color="var(--accent)" unit={`/${teams.length}`} />}
              </>)}

              {/* 2. Points per mission bar chart */}
              {statCard(<>
                {statTitle('💰', 'MOST POINTS AWARDED (TOP 10)')}
                {pointStats.length === 0
                  ? <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No points yet.</div>
                  : <BarChart data={pointStats} maxValue={pointStats[0]?.value ?? 1} color="var(--gold)" unit=" pts" />}
              </>)}

              {/* 3. Would You answers */}
              {statCard(<>
                {statTitle('💬', 'WHO ON THE TEAM')}
                {wouldYouAnswers.length === 0
                  ? <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No answers submitted yet.</div>
                  : wouldYouAnswers.map(({ m, answers }) => (
                    <div key={m.id} style={{ marginBottom: '14px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 700, marginBottom: '8px' }}>{m.question}</div>
                      {answers.map(({ team, answer }) => (
                        <div key={team} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ color: 'var(--muted)' }}>{team}</span>
                          <span style={{ fontWeight: 700 }}>{answer}</span>
                        </div>
                      ))}
                    </div>
                  ))}
              </>)}

              {/* 4. Duel stolen — top 3 */}
              {statCard(<>
                {statTitle('⚔️', 'DUEL — MOST POINTS STOLEN (TOP 3)')}
                {duelStats.length === 0
                  ? <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No duels completed yet.</div>
                  : duelStats.map(({ name, value }, i) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', padding: '9px 0', borderBottom: i < duelStats.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span>{top3Medal(i)} {name}</span>
                      <span style={{ fontWeight: 800, color: 'var(--accent2)' }}>+{value} pts</span>
                    </div>
                  ))}
              </>)}

              {/* 5. Power-up targets — top 3 */}
              {statCard(<>
                {statTitle('🎯', 'MOST TARGETED BY OTHER TEAMS (TOP 3)')}
                {puTargetStats.length === 0
                  ? <div style={{ fontSize: '13px', color: 'var(--muted)' }}>No team power-ups used yet.</div>
                  : puTargetStats.map(({ name, value }, i) => (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', padding: '9px 0', borderBottom: i < puTargetStats.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <span>{top3Medal(i)} {name}</span>
                      <span style={{ fontWeight: 800, color: 'var(--accent)' }}>{value}× targeted</span>
                    </div>
                  ))}
              </>)}
            </div>
          );
        })()}

        {/* POWER-UPS */}
        {tab === 'powerups' && activeGame.status === 'active' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Power-ups</h2>
              <span className="badge">{teams.length} teams</span>
            </div>
            {plan === 'free' && (
              <div style={{ background: 'rgba(124,189,212,0.08)', border: '1px solid rgba(124,189,212,0.2)', borderRadius: '12px', padding: '24px', textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚡</div>
                <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '8px', color: 'var(--text)' }}>Power-ups ingår i Pro</div>
                <div style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '16px' }}>Sabotage, dubbelpoäng, falsk ledtråd och mer — uppgradera för att aktivera dem live under spelet.</div>
                <button className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #7CBDD4, #4890aa)', color: '#0D1520', border: 'none', fontWeight: 800 }} onClick={() => handleUpgrade('pro')} disabled={upgradeLoading}>
                  {upgradeLoading ? '...' : '⚡ Upgrade to Pro'}
                </button>
              </div>
            )}
            <PowerUpsCard
              teams={teams}
              gameId={activeGame.id}
              gameMissionIds={activeGame.missions}
              powerupsUsed={powerupsUsed}
              puTargets={puTargets}
              setPuTargets={setPuTargets}
              puMessages={puMessages}
              setPuMessages={setPuMessages}
              puLoading={puLoading}
              onActivate={activatePowerup}
              hotPotatoMissionId={hotPotatoMissionId}
              setHotPotatoMissionId={setHotPotatoMissionId}
              onHotPotato={activateHotPotato}
              hotPotatoLoading={hotPotatoLoading}
              hotPotatoActive={hotPotatoActive}
            />
          </div>
        )}

        {/* ANALYTICS — super-admin only */}
        {tab === 'customers' && isSuperAdmin && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Analytics</h2>
              {analytics && <span className="badge">{analytics.kpis.totalGames} spel</span>}
            </div>

            {analyticsLoading && (
              <div className="empty-state">Laddar analytics...</div>
            )}

            {!analyticsLoading && !analytics && (
              <div className="empty-state">Ingen data ännu.</div>
            )}

            {analytics && (() => {
              const { kpis, customers: analyticsCustomers, missionStats } = analytics;

              function rateColor(rate: number) {
                if (rate >= 0.8) return 'var(--accent3)';
                if (rate >= 0.5) return 'var(--gold)';
                return 'var(--accent2)';
              }

              return (
                <>
                  {/* ── KPI Cards ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Totalt spel</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{kpis.totalGames}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{kpis.finishedGames} avslutade</div>
                    </div>
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Aktiva kunder</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{kpis.activeCustomers}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>{kpis.activeCustomers30d} aktiva senaste 30d</div>
                    </div>
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Spelklar-rate</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: rateColor(kpis.completionRate) }}>{Math.round(kpis.completionRate * 100)}%</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>spel som slutförts</div>
                    </div>
                    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '6px' }}>Snitt lag/spel</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text)' }}>{kpis.avgTeamsPerGame}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>totalt {kpis.totalTeams} lag</div>
                    </div>
                  </div>

                  {/* ── Two-column layout ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>

                    {/* Left: Customer list */}
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>
                        Kunder ({analyticsCustomers.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {analyticsCustomers.length === 0 && (
                          <div className="empty-state">Inga kunder ännu.</div>
                        )}
                        {analyticsCustomers.map(c => (
                          <div key={c.id}>
                            <div
                              onClick={() => setExpandedCustomer(expandedCustomer === c.id ? null : c.id)}
                              style={{
                                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: expandedCustomer === c.id ? '12px 12px 0 0' : '12px',
                                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {c.email}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                                  {c.lastActive ? new Date(c.lastActive).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Inget spel'}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>{c.gameCount}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>spel</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--muted)' }}>{c.avgTeams}</div>
                                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>lag/spel</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '13px', fontWeight: 700, color: rateColor(c.completionRate) }}>{Math.round(c.completionRate * 100)}%</div>
                                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>klar</div>
                                </div>
                                <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{expandedCustomer === c.id ? '▲' : '▼'}</div>
                              </div>
                            </div>
                            {expandedCustomer === c.id && (
                              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '6px 0' }}>
                                {c.games.length === 0 && (
                                  <div style={{ padding: '12px 14px', fontSize: '12px', color: 'var(--muted)' }}>Inga spel.</div>
                                )}
                                {c.games.map(g => (
                                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', gap: '10px', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {g.name ?? '(namnlöst)'}
                                      </div>
                                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '1px' }}>
                                        {g.startedAt ? new Date(g.startedAt).toLocaleDateString('sv-SE') : '—'}
                                      </div>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--muted)', flexShrink: 0 }}>{g.teamCount} lag</div>
                                    <div style={{ fontSize: '11px', color: 'var(--accent)', flexShrink: 0, fontWeight: 700 }}>{g.topScore}p</div>
                                    <div style={{ fontSize: '11px', flexShrink: 0, color: g.finished ? 'var(--accent3)' : 'var(--muted)' }}>
                                      {g.finished ? '✓' : '—'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: Mission rankings */}
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '10px' }}>
                        Uppdragsranking
                      </div>
                      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 70px', gap: '8px', padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          <div>Uppdrag</div>
                          <div style={{ textAlign: 'right' }}>Spel</div>
                          <div style={{ textAlign: 'right' }}>Klarade</div>
                        </div>
                        {missionStats.length === 0 && (
                          <div style={{ padding: '16px 14px', fontSize: '12px', color: 'var(--muted)' }}>Ingen data.</div>
                        )}
                        {missionStats.map(m => (
                          <div key={m.id} style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px 70px', gap: '8px', alignItems: 'center', marginBottom: '5px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                              <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'right' }}>{m.gameCount}</div>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: rateColor(m.completionRate), textAlign: 'right' }}>{Math.round(m.completionRate * 100)}%</div>
                            </div>
                            <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.round(m.completionRate * 100)}%`, background: rateColor(m.completionRate), borderRadius: '2px' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </>
              );
            })()}

          </div>
        )}
      </div>
      {/* ── Toast notifications ── */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 9999, pointerEvents: 'none', alignItems: 'center' }}>
          {toasts.map(t => (
            <div key={t.id} style={{
              background: t.type === 'error' ? 'rgba(42,10,10,0.95)' : 'rgba(22,32,48,0.95)',
              border: `1px solid ${t.type === 'error' ? 'rgba(255,100,100,0.35)' : 'rgba(124,189,212,0.35)'}`,
              color: t.type === 'error' ? '#ff8888' : '#DCE4EE',
              padding: '11px 20px',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
              whiteSpace: 'nowrap',
            }}>
              {t.msg}
            </div>
          ))}
        </div>
      )}

      {/* ── MOBILE BOTTOM NAV ── */}
      {isMobile && (
        <>
          {/* More sheet overlay */}
          {mobileMoreOpen && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                onClick={() => setMobileMoreOpen(false)}
              />
              <div className="mobile-more-sheet">
                <button
                  className="mobile-more-sheet-item"
                  onClick={() => { setTab('progress'); setMobileMoreOpen(false); }}
                >
                  📊 Progress
                </button>
                <button
                  className="mobile-more-sheet-item"
                  onClick={() => { setTab('stats'); setMobileMoreOpen(false); }}
                >
                  📈 Stats
                </button>
                {isSuperAdmin && (
                  <button
                    className="mobile-more-sheet-item"
                    onClick={() => { setTab('customers'); loadAnalytics(); setMobileMoreOpen(false); }}
                  >
                    📊 Analytics
                  </button>
                )}
              </div>
            </>
          )}

          {/* FAB — create new game */}
          <button
            className="mobile-fab"
            onClick={() => setView('create')}
            aria-label="Create new game"
          >
            +
          </button>

          {/* Bottom navigation */}
          <nav className="mobile-bottom-nav">
            <button
              className={`mobile-bottom-nav-item${tab === 'leaderboard' ? ' active' : ''}`}
              onClick={() => { setTab('leaderboard'); setMobileMoreOpen(false); }}
            >
              <span className="mobile-nav-icon">🏆</span>
              <span className="mobile-nav-label">Leaderboard</span>
            </button>
            <button
              className={`mobile-bottom-nav-item${tab === 'photos' ? ' active' : ''}`}
              onClick={() => { setTab('photos'); setMobileMoreOpen(false); }}
              style={{ position: 'relative' }}
            >
              <span className="mobile-nav-icon">📸</span>
              <span className="mobile-nav-label">
                Photos{totalPendingPhotos > 0 ? ` · ${totalPendingPhotos}` : ''}
              </span>
            </button>
            <button
              className={`mobile-bottom-nav-item${tab === 'powerups' ? ' active' : ''}`}
              onClick={() => { setTab('powerups'); setMobileMoreOpen(false); }}
            >
              <span className="mobile-nav-icon">⚡</span>
              <span className="mobile-nav-label">Power-ups</span>
            </button>
            <button
              className={`mobile-bottom-nav-item${mobileMoreOpen ? ' active' : ''}`}
              onClick={() => setMobileMoreOpen(o => !o)}
            >
              <span className="mobile-nav-icon" style={{ letterSpacing: '-2px' }}>···</span>
              <span className="mobile-nav-label">More</span>
            </button>
          </nav>
        </>
      )}
    </>
  );
}
