'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
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
type AdminView = 'games' | 'create' | 'dashboard';

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
  const [photoTeamFilter, setPhotoTeamFilter] = useState<string>('all');
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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; email: string; created_at: string; last_sign_in_at: string | null; game_count: number; is_super_admin: boolean }[]>([]);

  // Load auth token on mount and subscribe to changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthToken(session?.access_token ?? null);
    });
    // Use getUser() for fresh server-side data (not cached JWT)
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsSuperAdmin(user?.app_metadata?.role === 'superadmin');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthToken(session?.access_token ?? null);
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

    async function poll() {
      const pollStartedAt = Date.now();

      const [teamsRes, photosRes, scavengerRes, gameRes, settingsRes] = await Promise.all([
        POST('/api/admin/teams', { gameId }),
        POST('/api/admin/photos'),
        POST('/api/scavenger/submissions'),
        POST('/api/game', { key: gameKey }),
        POST('/api/settings', { gameId }),
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
        await POST('/api/admin/powerup/resolve-hot-potato', { gameId });
        // Refresh settings after resolution
        const freshSd = await POST('/api/settings', { gameId }).then(r => r.json());
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
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch('/api/admin/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: activeGame.id, action }),
    });
    const data = await res.json();
    // Directly set the authoritative state returned by the command.
    // This intentionally bypasses applyGame so a restart can go from
    // finished → draft without the status-priority guard blocking it.
    if (data.game) setActiveGame(data.game);
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId: sub.id, teamId: sub.team_id, missionId: sub.mission_id, points: pts }),
    });
    setRated(r => new Set([...r, sub.id]));
    if (activeGame) loadGameData(activeGame);
  }

  async function rateScavengerPhoto(sub: ScavengerSubmission, pts: number) {
    await fetch('/api/scavenger/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        alert(`Time Bomb failed: ${err.error ?? res.statusText}`);
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
        alert(`Power-up failed: ${err.error ?? res.statusText}`);
        return;
      }
      const sd = await POST('/api/settings', { gameId: activeGame?.id }).then(r => r.json());
      if (sd.powerups_used) setPowerupsUsed(sd.powerups_used);
    } finally {
      setPuLoading(null);
    }
  }

  async function loadCustomers() {
    const res = await POST('/api/admin/superadmin/users');
    const data = await res.json();
    if (data.users) setCustomers(data.users);
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
        <div className="nav-right">
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onLogout}>LOG OUT</button>
        </div>
      </nav>
      <div className="container fade-in">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px 0 24px' }}>
          <h2>Your Games</h2>
          <button className="btn btn-primary" onClick={() => setView('create')}>+ NEW GAME</button>
        </div>
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

      <div className="container fade-in">
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
            <button className={`admin-tab${tab === 'powerups' ? ' active' : ''}`} onClick={() => setTab('powerups')}>⚡ Power-ups</button>
          )}
          {isSuperAdmin && (
            <button className={`admin-tab${tab === 'customers' ? ' active' : ''}`} onClick={() => { setTab('customers'); loadCustomers(); }}>👥 Customers</button>
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
                  onChange={e => setPhotoTeamFilter(e.target.value)}
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
            {photos.filter(s => s.status !== 'rated' && !rated.has(s.id) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter)).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {photos.filter(s => s.status !== 'rated' && !rated.has(s.id) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter)).map(sub => {
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
            )}

            {/* Pending scavenger photos */}
            {scavengerSubs.filter(s => s.status !== 'rated' && !scavengerRated.has(s.id) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter)).length > 0 && (
              <>
                <div className="section-header" style={{ marginTop: '32px' }}>
                  <h2 style={{ fontSize: '18px' }}>📍 Scavenger Hunt</h2>
                  <span className="badge">{scavengerSubs.filter(s => s.status !== 'rated' && !scavengerRated.has(s.id) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter)).length} pending</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                  {scavengerSubs.filter(s => s.status !== 'rated' && !scavengerRated.has(s.id) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter)).map(sub => (
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
              </>
            )}

            {/* Rated archive — regular + scavenger combined */}
            {(photos.filter(s => (s.status === 'rated' || rated.has(s.id)) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter)).length > 0 ||
              scavengerSubs.filter(s => (s.status === 'rated' || scavengerRated.has(s.id)) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter)).length > 0) && (
              <>
                <div className="section-header" style={{ marginTop: '28px' }}>
                  <h2 style={{ fontSize: '16px', color: 'var(--muted)' }}>✓ Rated</h2>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    {photos.filter(s => (s.status === 'rated' || rated.has(s.id)) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter)).length +
                     scavengerSubs.filter(s => (s.status === 'rated' || scavengerRated.has(s.id)) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter)).length} photos
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', opacity: 0.7 }}>
                  {photos.filter(s => (s.status === 'rated' || rated.has(s.id)) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter)).map(sub => {
                    const mission = MISSIONS.find(m => m.id === sub.mission_id);
                    return (
                      <div key={sub.id} style={{ background: 'var(--card)', border: '1px solid var(--accent3)', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '6px 10px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px' }}>{mission?.icon ?? '📸'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.team_name}</div>
                          </div>
                          <span style={{ color: 'var(--accent3)', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>✓ {sub.points_awarded ?? 0}p</span>
                        </div>
                        <div
                          style={{ height: '140px', overflow: 'hidden', cursor: 'zoom-in' }}
                          onClick={() => setPhotoModal({ url: sub.photo_url, label: `${sub.team_name} — ${mission?.name ?? sub.mission_id}` })}
                        >
                          <img src={sub.photo_url} alt={sub.team_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                      </div>
                    );
                  })}
                  {scavengerSubs.filter(s => (s.status === 'rated' || scavengerRated.has(s.id)) && (photoTeamFilter === 'all' || s.team_id === photoTeamFilter)).map(sub => (
                    <div key={sub.id} style={{ background: 'var(--card)', border: '1px solid var(--accent3)', borderRadius: '12px', overflow: 'hidden' }}>
                      <div style={{ padding: '6px 10px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px' }}>📍</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub.team_name}</div>
                        </div>
                        <span style={{ color: 'var(--accent3)', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>✓ {sub.points_awarded ?? 0}p</span>
                      </div>
                      <div
                        style={{ height: '140px', overflow: 'hidden', cursor: 'zoom-in' }}
                        onClick={() => setPhotoModal({ url: sub.photo_url, label: `${sub.team_name} — ${sub.item_label}` })}
                      >
                        <img src={sub.photo_url} alt={sub.item_label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
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

        {/* CUSTOMERS — super-admin only */}
        {tab === 'customers' && isSuperAdmin && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Customers</h2>
              <span className="badge">{customers.length} accounts</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {customers.length === 0 && (
                <div className="empty-state">No customers yet.</div>
              )}
              {customers.map(c => (
                <div key={c.id} style={{
                  background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px',
                  padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: c.is_super_admin ? 'var(--gold)' : 'var(--text)' }}>
                      {c.email}{c.is_super_admin ? ' ⭐' : ''}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '3px' }}>
                      Joined {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {c.last_sign_in_at && ` · Last login ${new Date(c.last_sign_in_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--accent)' }}>{c.game_count}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>game{c.game_count !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
