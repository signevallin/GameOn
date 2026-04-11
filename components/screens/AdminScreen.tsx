'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MISSIONS } from '@/lib/missions';
import { Team, Game } from '@/lib/supabase';

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
      <span style={{ fontSize: '11px', letterSpacing: '4px', color: 'var(--accent)', opacity: 0.7, fontWeight: 700 }}>GAMEON</span>
      {game && game.status === 'active' && secondsLeft !== null && (
        <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '18px', color: timerColor, letterSpacing: '2px', lineHeight: 1, animation: urgentTime ? 'pulse 0.5s infinite alternate' : 'none' }}>
          ⏱ {fmtTimer(secondsLeft)}
        </span>
      )}
    </div>
  );
}

type PowerUpsCardProps = {
  teams: Team[];
  powerupsUsed: string[];
  puTargets: Record<string, string>;
  setPuTargets: (v: Record<string, string>) => void;
  puMessages: string;
  setPuMessages: (v: string) => void;
  puLoading: string | null;
  onActivate: (type: string) => void;
};

function PowerUpsCard({
  teams, powerupsUsed, puTargets, setPuTargets, puMessages, setPuMessages, puLoading, onActivate,
}: PowerUpsCardProps) {
  function isUsed(type: string, teamId: string) {
    return powerupsUsed.includes(`${type}_${teamId}`);
  }

  function usedOnNames(type: string) {
    return powerupsUsed
      .filter(k => k.startsWith(`${type}_`))
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
    { type: 'sabotage', icon: '🧨', label: 'Sabotage a team', btn: 'ACTIVATE' },
    { type: 'double_points', icon: '🎯', label: 'Double points', btn: 'ACTIVATE' },
    { type: 'fake_hint', icon: '🔍', label: 'Fake hint', btn: 'SEND' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {POWERS.map(({ type, icon, label, btn }) => {
        const usedNames = usedOnNames(type);
        const selectedTeamId = puTargets[type];
        const alreadyUsedOnSelected = selectedTeamId ? isUsed(type, selectedTeamId) : false;
        const isLoading = puLoading === type;

        return (
          <div key={type} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, flex: '0 0 auto' }}>{label}</span>
              <select
                value={selectedTeamId}
                onChange={e => setTarget(type, e.target.value)}
                style={selectStyle}
              >
                <option value="">Select team…</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id} disabled={isUsed(type, t.id)}>
                    {t.name}{isUsed(type, t.id) ? ' ✓' : ''}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '12px', flexShrink: 0 }}
                disabled={!selectedTeamId || alreadyUsedOnSelected || isLoading || (type === 'fake_hint' && !puMessages.trim())}
                onClick={() => onActivate(type)}
              >
                {isLoading ? '...' : btn}
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
            {usedNames.length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--accent3)', marginTop: '8px' }}>
                ✓ Used on: {usedNames.join(', ')}
              </div>
            )}
          </div>
        );
      })}
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
const POINT_OPTIONS = [0, 100, 200, 300, 400, 500];

export default function AdminScreen({ onLogout }: Props) {
  const [view, setView] = useState<AdminView>('games');
  const [games, setGames] = useState<Game[]>([]);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [photos, setPhotos] = useState<PhotoSubmission[]>([]);
  const [tab, setTab] = useState<'leaderboard' | 'progress' | 'photos' | 'powerups'>('leaderboard');
  const [rated, setRated] = useState<Set<string>>(new Set());
  const [powerupsUsed, setPowerupsUsed] = useState<string[]>([]);
  const [puTargets, setPuTargets] = useState<Record<string, string>>({
    sabotage: '', double_points: '', fake_hint: '',
  });
  const [puMessages, setPuMessages] = useState('');
  const [puLoading, setPuLoading] = useState<string | null>(null);

  // Create form state
  const [gameName, setGameName] = useState('');
  const [duration, setDuration] = useState(45);
  const [selectedMissions, setSelectedMissions] = useState<string[]>(MISSIONS.map(m => m.id));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Timestamp of the last admin command (start/finish/restart).
  // Polls that started BEFORE a command are discarded to prevent race conditions.
  const lastCommandAtRef = useRef(0);

  const POST = (url: string, body?: object) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  });

  const loadGames = useCallback(async () => {
    const res = await POST('/api/admin/game', { action: 'list' });
    const data = await res.json();
    if (data.games) setGames(data.games);
  }, []);

  const loadGameData = useCallback(async (game: Game) => {
    const [teamsRes, photosRes, gameRes, settingsRes] = await Promise.all([
      POST('/api/admin/teams', { gameId: game.id }),
      POST('/api/admin/photos'),
      POST('/api/game', { key: game.game_key }),
      POST('/api/settings'),
    ]);
    const [td, pd, gd, sd] = await Promise.all([
      teamsRes.json(), photosRes.json(), gameRes.json(), settingsRes.json(),
    ]);
    if (td.teams) setTeams(td.teams);
    if (pd.submissions) setPhotos(pd.submissions.filter((s: PhotoSubmission) =>
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
  }, []);

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

      const [teamsRes, photosRes, gameRes, settingsRes] = await Promise.all([
        POST('/api/admin/teams', { gameId }),
        POST('/api/admin/photos'),
        POST('/api/game', { key: gameKey }),
        POST('/api/settings'),
      ]);
      const [td, pd, gd, sd] = await Promise.all([
        teamsRes.json(), photosRes.json(), gameRes.json(), settingsRes.json(),
      ]);

      if (pollStartedAt < lastCommandAtRef.current) return;

      if (td.teams) setTeams(td.teams);
      if (pd.submissions) setPhotos(pd.submissions.filter((s: PhotoSubmission) =>
        td.teams?.some((t: Team) => t.id === s.team_id)
      ));
      if (gd.game) applyGame(gd.game);
      if (sd.powerups_used) setPowerupsUsed(sd.powerups_used);
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGameId]);

  async function createGame() {
    if (!selectedMissions.length) { setCreateError('Select at least one mission.'); return; }
    setCreating(true); setCreateError('');
    const res = await fetch('/api/admin/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: gameName, missions: selectedMissions, duration_minutes: duration }),
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

  async function activatePowerup(type: string) {
    const targetTeamId = puTargets[type];
    if (!targetTeamId) return;
    setPuLoading(type);
    try {
      const res = await POST('/api/admin/powerup', {
        type,
        targetTeamId,
        ...(type === 'fake_hint' ? { message: puMessages } : {}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        alert(`Power-up failed: ${err.error ?? res.statusText}`);
        return;
      }
      const sd = await POST('/api/settings').then(r => r.json());
      if (sd.powerups_used) setPowerupsUsed(sd.powerups_used);
    } finally {
      setPuLoading(null);
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
        <div className="nav-brand">🛡️ ADMIN</div>
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
        <div className="nav-brand">🎮 NEW GAME</div>
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
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <label className="form-label" style={{ margin: 0 }}>Select Missions ({selectedMissions.length} selected)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setSelectedMissions(MISSIONS.map(m => m.id))}>All on</button>
              <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }} onClick={() => setSelectedMissions([])}>All off</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {MISSIONS.map(m => {
              const on = selectedMissions.includes(m.id);
              return (
                <div key={m.id} onClick={() => setSelectedMissions(prev => on ? prev.filter(x => x !== m.id) : [...prev, m.id])}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', background: 'var(--card)', border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', opacity: on ? 1 : 0.45, transition: 'all 0.15s' }}>
                  <span style={{ fontSize: '20px' }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{m.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{m.category} · {m.difficulty} · up to {m.maxPts} pts</div>
                  </div>
                  <div style={{ width: '40px', height: '22px', borderRadius: '11px', background: on ? 'var(--accent)' : 'var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ position: 'absolute', top: '3px', left: on ? '21px' : '3px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
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

  return (
    <>
      <nav className="nav" style={{ position: 'relative' }}>
        <div className="nav-brand">🎮 {activeGame.name}</div>
        <NavCenter game={activeGame} />
        <div className="nav-right">
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => { loadGames(); setTeams([]); setPhotos([]); setView('games'); }}>← GAMES</button>
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onLogout}>LOG OUT</button>
        </div>
      </nav>

      <div className="container fade-in">
        {/* GAME KEY + START */}
        <div style={{ padding: '28px 0 24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '6px' }}>GAME KEY — share this with your teams</p>
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
            {pendingPhotos.length > 0 && (
              <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: 'var(--accent2)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                {pendingPhotos.length}
              </span>
            )}
          </button>
          {activeGame.status === 'active' && (
            <button className={`admin-tab${tab === 'powerups' ? ' active' : ''}`} onClick={() => setTab('powerups')}>⚡ Power-ups</button>
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
        {tab === 'progress' && (
          <div className="fade-in">
            <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'auto' }}>
              <table className="progress-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    {activeGame.missions.map(id => {
                      const m = MISSIONS.find(x => x.id === id);
                      return <th key={id}>{m?.icon ?? id}</th>;
                    })}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={activeGame.missions.length + 2} style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '12px' }}>Waiting for teams...</td></tr>
                  ) : sorted.map(t => (
                    <tr key={t.id}>
                      <td><strong>{t.name}</strong></td>
                      {activeGame.missions.map(id => {
                        const done = t.completed?.includes(id);
                        const pts = done ? (t.mission_scores?.[id] ?? null) : null;
                        return (
                          <td key={id}>
                            {done
                              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--accent3)', fontWeight: 700, fontSize: '12px' }}>
                                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent3)', display: 'inline-block', flexShrink: 0 }} />
                                  {pts !== null ? pts : '✓'}
                                </span>
                              : <span style={{ color: 'var(--muted)' }}>–</span>
                            }
                          </td>
                        );
                      })}
                      <td className="pts-cell">{t.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PHOTOS */}
        {tab === 'photos' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Photo Submissions</h2>
              <span className="badge">{pendingPhotos.length} pending</span>
            </div>
            {photos.length === 0 ? <div className="empty-state">No photos submitted yet.</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {photos.map(sub => {
                  const isRated = sub.status === 'rated' || rated.has(sub.id);
                  const mission = MISSIONS.find(m => m.id === sub.mission_id);
                  return (
                    <div key={sub.id} style={{ background: 'var(--card)', border: `1px solid ${isRated ? 'var(--accent3)' : 'var(--border)'}`, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      {/* Mission badge */}
                      <div style={{ padding: '8px 12px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '14px' }}>{mission?.icon ?? '📸'}</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {mission?.name ?? sub.mission_id}
                        </span>
                      </div>
                      {/* Thumbnail */}
                      <div style={{ height: '200px', overflow: 'hidden', flexShrink: 0 }}>
                        <img src={sub.photo_url} alt={sub.team_name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </div>
                      <div style={{ padding: '12px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>{sub.team_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{new Date(sub.created_at).toLocaleTimeString()}</div>
                          </div>
                          {isRated
                            ? <span style={{ color: 'var(--accent3)', fontWeight: 700, fontSize: '13px' }}>✓ {sub.points_awarded ?? ''} p</span>
                            : <span className="badge">Pending</span>}
                        </div>
                        {!isRated && (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {POINT_OPTIONS.map(pts => (
                              <button key={pts} onClick={() => ratePhoto(sub, pts)}
                                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: pts === 500 ? 'rgba(222,187,107,0.15)' : pts === 0 ? 'rgba(208,117,125,0.10)' : 'var(--surface)', color: pts === 500 ? 'var(--gold)' : pts === 0 ? 'var(--accent2)' : 'var(--text)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '12px' }}>
                                {pts}p
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* POWER-UPS */}
        {tab === 'powerups' && activeGame.status === 'active' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Power-ups</h2>
              <span className="badge">{teams.length} teams</span>
            </div>
            <PowerUpsCard
              teams={teams}
              powerupsUsed={powerupsUsed}
              puTargets={puTargets}
              setPuTargets={setPuTargets}
              puMessages={puMessages}
              setPuMessages={setPuMessages}
              puLoading={puLoading}
              onActivate={activatePowerup}
            />
          </div>
        )}
      </div>
    </>
  );
}
