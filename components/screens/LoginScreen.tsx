'use client';
import { useState, useEffect } from 'react';
import { Team, Game, supabase } from '@/lib/supabase';
import GameOnLogo from '@/components/GameOnLogo';
import dynamic from 'next/dynamic';

const QrScanner = dynamic(() => import('@/components/QrScanner'), { ssr: false });

type Props = {
  onTeamLogin: (team: Team, game: Game, customMissions?: import('@/lib/supabase').CustomMission[]) => void;
  onAdminLogin: () => void;
};

export default function LoginScreen({ onTeamLogin, onAdminLogin }: Props) {
  const [mode, setMode] = useState<'team' | 'admin'>('team');
  const [adminMode, setAdminMode] = useState<'login' | 'register'>('login');
  const [teamName, setTeamName] = useState('');
  const [gameKey, setGameKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get('key');
    if (key) setGameKey(key.toUpperCase());
  }, []);

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
      onTeamLogin(data.team, data.game, data.customMissions ?? []);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin() {
    setError('');
    if (!email.trim()) { setError('Enter your email.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) { setError(authError.message); return; }
      onAdminLogin();
    } catch {
      setError('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminRegister() {
    setError('');
    if (!email.trim()) { setError('Enter your email.'); return; }
    if (!password) { setError('Enter a password.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (authError) { setError(authError.message); return; }
      // Auto-sign in after register
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) { setError('Account created! Please log in.'); setAdminMode('login'); return; }
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
          <GameOnLogo size={58} />
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
                <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                  <input
                    type="text"
                    placeholder="E.g. X7K2P9"
                    maxLength={6}
                    value={gameKey}
                    onChange={e => setGameKey(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && handleTeamLogin()}
                    style={{ letterSpacing: '4px', fontSize: '20px', textTransform: 'uppercase', flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    title="Scan QR code"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '0 14px',
                      cursor: 'pointer',
                      fontSize: '22px',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1"/>
                      <rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                      <rect x="14" y="14" width="3" height="3" rx="0.5"/>
                      <rect x="19" y="14" width="2" height="2" rx="0.5"/>
                      <rect x="14" y="19" width="2" height="2" rx="0.5"/>
                      <rect x="18" y="18" width="3" height="3" rx="0.5"/>
                    </svg>
                  </button>
                </div>
                {error && mode === 'team' && <p className="error-msg">{error}</p>}
              </div>
              {showScanner && (
                <QrScanner
                  onScan={(key) => { setGameKey(key.slice(0, 6)); setShowScanner(false); }}
                  onClose={() => setShowScanner(false)}
                />
              )}
              <button className="btn btn-primary btn-full" onClick={handleTeamLogin} disabled={loading}>
                {loading ? 'JOINING...' : 'JOIN GAME →'}
              </button>
            </>
          ) : (
            <>
              {/* Login / Register toggle */}
              <div style={{ display: 'flex', background: 'var(--surface)', borderRadius: '8px', padding: '3px', gap: '3px', marginBottom: '20px' }}>
                {(['login', 'register'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { setAdminMode(m); setError(''); }}
                    style={{
                      flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                      fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: '12px',
                      letterSpacing: '0.5px',
                      background: adminMode === m ? 'var(--accent)' : 'transparent',
                      color: adminMode === m ? 'var(--bg)' : 'var(--muted)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {m === 'login' ? 'LOG IN' : 'REGISTER'}
                  </button>
                ))}
              </div>

              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (adminMode === 'login' ? handleAdminLogin() : handleAdminRegister())}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (adminMode === 'login' ? handleAdminLogin() : handleAdminRegister())}
                />
              </div>
              {adminMode === 'register' && (
                <div className="form-group">
                  <label className="form-label">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdminRegister()}
                  />
                </div>
              )}
              {error && mode === 'admin' && <p className="error-msg" style={{ marginBottom: '12px' }}>{error}</p>}
              <button
                className="btn btn-primary btn-full"
                onClick={adminMode === 'login' ? handleAdminLogin : handleAdminRegister}
                disabled={loading}
              >
                {loading ? '...' : adminMode === 'login' ? 'LOG IN →' : 'CREATE ACCOUNT →'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
