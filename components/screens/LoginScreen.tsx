'use client';
import { useState } from 'react';
import { Team, Game } from '@/lib/supabase';

type Props = {
  onTeamLogin: (team: Team, game: Game) => void;
  onAdminLogin: () => void;
};

export default function LoginScreen({ onTeamLogin, onAdminLogin }: Props) {
  const [mode, setMode] = useState<'team' | 'admin'>('team');
  const [teamName, setTeamName] = useState('');
  const [gameKey, setGameKey] = useState('');
  const [adminPass, setAdminPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleTeamLogin() {
    setError('');
    if (!teamName.trim()) { setError('Enter a team name.'); return; }
    if (!gameKey.trim()) { setError('Enter the game key.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/team/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName.trim(), gameKey: gameKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onTeamLogin(data.team, data.game);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPass }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onAdminLogin();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '480px', padding: '20px', position: 'relative', zIndex: 1 }} className="fade-in">
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          {/* GameOn logo — "Game" white, power symbol + "n" in accent blue */}
          <div style={{ display: 'inline-flex', alignItems: 'baseline', lineHeight: 1 }}>
            <span style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 800,
              fontSize: '58px',
              color: '#e0e7f3',
              letterSpacing: '-1px',
            }}>Game</span>
            <span style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 800,
              fontSize: '80px',
              color: 'var(--accent)',
              lineHeight: 1,
              position: 'relative',
              top: '2px',
              marginRight: '-6px',
            }}>⏻</span>
            <span style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 800,
              fontSize: '58px',
              color: 'var(--accent)',
              letterSpacing: '-1px',
            }}>n</span>
          </div>
          <p style={{ color: 'var(--muted)', marginTop: '12px', fontSize: '14px' }}>Select your role to log in</p>
        </div>

        <div className="login-tabs">
          <button className={`tab-btn${mode === 'team' ? ' active' : ''}`} onClick={() => { setMode('team'); setError(''); }}>
            🧑‍💻 TEAM
          </button>
          <button className={`tab-btn${mode === 'admin' ? ' active' : ''}`} onClick={() => { setMode('admin'); setError(''); }}>
            🛡️ ADMIN
          </button>
        </div>

        <div className="card">
          {mode === 'team' ? (
            <>
              <div className="form-group">
                <label className="form-label">Team Name</label>
                <input
                  type="text"
                  placeholder="E.g. Team Frontend"
                  maxLength={20}
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTeamLogin()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Game Key (from the organiser)</label>
                <input
                  type="text"
                  placeholder="E.g. X7K2P9"
                  maxLength={6}
                  value={gameKey}
                  onChange={e => setGameKey(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && handleTeamLogin()}
                  style={{ letterSpacing: '4px', fontSize: '20px', textTransform: 'uppercase' }}
                />
                {error && <p className="error-msg">{error}</p>}
              </div>
              <button className="btn btn-primary btn-full" onClick={handleTeamLogin} disabled={loading}>
                {loading ? 'JOINING...' : 'JOIN GAME →'}
              </button>
            </>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Admin Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={adminPass}
                  onChange={e => setAdminPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                />
                {error && <p className="error-msg">{error}</p>}
              </div>
              <button className="btn btn-primary btn-full" onClick={handleAdminLogin} disabled={loading}>
                {loading ? 'LOGGING IN...' : 'LOG IN AS ADMIN →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
