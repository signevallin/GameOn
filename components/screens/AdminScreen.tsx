'use client';
import { useCallback, useEffect, useState } from 'react';
import { MISSIONS } from '@/lib/missions';
import { Team, Game } from '@/lib/supabase';

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
  const [tab, setTab] = useState<'leaderboard' | 'progress' | 'photos'>('leaderboard');
  const [rated, setRated] = useState<Set<string>>(new Set());

  // Create form state
  const [gameName, setGameName] = useState('');
  const [duration, setDuration] = useState(45);
  const [selectedMissions, setSelectedMissions] = useState<string[]>(MISSIONS.map(m => m.id));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const loadGames = useCallback(async () => {
    const res = await fetch('/api/admin/game');
    const data = await res.json();
    if (data.games) setGames(data.games);
  }, []);

  const loadGameData = useCallback(async (game: Game) => {
    const [teamsRes, photosRes, gameRes] = await Promise.all([
      fetch(`/api/admin/teams?gameId=${game.id}`),
      fetch('/api/admin/photos'),
      fetch(`/api/game?key=${game.game_key}`),
    ]);
    const [td, pd, gd] = await Promise.all([teamsRes.json(), photosRes.json(), gameRes.json()]);
    if (td.teams) setTeams(td.teams);
    if (pd.submissions) setPhotos(pd.submissions.filter((s: PhotoSubmission) =>
      td.teams?.some((t: Team) => t.id === s.team_id)
    ));
    if (gd.game) setActiveGame(gd.game);
  }, []);

  useEffect(() => { loadGames(); }, [loadGames]);

  useEffect(() => {
    if (!activeGame) return;
    loadGameData(activeGame);
    const id = setInterval(() => loadGameData(activeGame), 5000);
    return () => clearInterval(id);
  }, [activeGame, loadGameData]);

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

  async function startOrStop(action: 'start' | 'finish') {
    if (!activeGame) return;
    const res = await fetch('/api/admin/game/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId: activeGame.id, action }),
    });
    const data = await res.json();
    if (data.game) setActiveGame(data.game);
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

  const sorted = [...teams].sort((a, b) => b.score - a.score);

  // ── GAMES LIST ──
  if (view === 'games') return (
    <>
      <nav className="nav">
        <div className="nav-brand">🛡️ ADMIN</div>
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
              return (
                <div key={g.id} onClick={() => { setActiveGame(g); setView('dashboard'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 24px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '16px' }}>{g.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                      {g.missions.length} missions · {g.duration_minutes} min
                    </div>
                  </div>
                  <div style={{ fontFamily: "'Sora', sans-serif", letterSpacing: '3px', fontSize: '18px', fontWeight: 700, color: 'var(--accent)' }}>{g.game_key}</div>
                  <div style={{ fontSize: '13px', color: statusColor, fontWeight: 700 }}>{statusLabel}</div>
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
      <nav className="nav">
        <div className="nav-brand">🎮 NEW GAME</div>
        <div className="nav-right">
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => setView('games')}>← BACK</button>
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
      <nav className="nav">
        <div className="nav-brand">🎮 {activeGame.name}</div>
        <div className="nav-right">
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => { setView('games'); setTeams([]); setPhotos([]); }}>← GAMES</button>
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
          <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
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
        </div>

        {/* LEADERBOARD */}
        {tab === 'leaderboard' && (
          <div className="fade-in">
            <div className="section-header">
              <h2 style={{ fontSize: '18px' }}>Leaderboard</h2>
              <span className="badge">{teams.length} teams</span>
            </div>
            <div className="leaderboard">
              {sorted.length === 0 ? <div className="empty-state">No teams yet.</div> : sorted.map((t, i) => (
                <div className="lb-row" key={t.id}>
                  <div className="lb-rank" style={{ color: RANK_COLORS[i] ?? 'var(--muted)' }}>{RANK_ICONS[i] ?? i + 1}</div>
                  <div className="lb-name">{t.name}</div>
                  <div className="lb-completed">{t.completed?.length ?? 0}/{activeGame.missions.length} missions</div>
                  <div className="lb-score">{t.score} p</div>
                </div>
              ))}
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
                        return <td key={id}><span className={`status-dot ${done ? 'dot-done' : 'dot-pending'}`} />{done ? '✓' : '–'}</td>;
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {photos.map(sub => {
                  const isRated = sub.status === 'rated' || rated.has(sub.id);
                  return (
                    <div key={sub.id} style={{ background: 'var(--card)', border: `1px solid ${isRated ? 'var(--accent3)' : 'var(--border)'}`, borderRadius: '12px', overflow: 'hidden' }}>
                      <img src={sub.photo_url} alt={sub.team_name} style={{ width: '100%', maxHeight: '360px', objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '15px' }}>{sub.team_name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{new Date(sub.created_at).toLocaleTimeString()}</div>
                          </div>
                          {isRated ? <span style={{ color: 'var(--accent3)', fontWeight: 700 }}>✓ {sub.points_awarded ?? ''} pts awarded</span> : <span className="badge">Pending</span>}
                        </div>
                        {!isRated && (
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {POINT_OPTIONS.map(pts => (
                              <button key={pts} onClick={() => ratePhoto(sub, pts)}
                                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: pts === 500 ? 'rgba(222,187,107,0.15)' : pts === 0 ? 'rgba(208,117,125,0.10)' : 'var(--surface)', color: pts === 500 ? 'var(--gold)' : pts === 0 ? 'var(--accent2)' : 'var(--text)', cursor: 'pointer', fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '13px' }}>
                                {pts} p
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
      </div>
    </>
  );
}
