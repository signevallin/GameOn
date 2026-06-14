'use client';
import { useState, useEffect } from 'react';
import { MailCheck, Users, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Team, Game, supabase } from '@/lib/supabase';
import GameOnLogo from '@/components/GameOnLogo';
import dynamic from 'next/dynamic';
import LanguagePicker from '@/components/LanguagePicker';

const QrScanner = dynamic(() => import('@/components/QrScanner'), { ssr: false });

type Props = {
  onTeamLogin: (
    team: Team,
    game: Game,
    customMissions?: import('@/lib/supabase').CustomMission[],
    memberId?: string,
    memberName?: string
  ) => void;
  onAdminLogin: () => void;
};

export default function LoginScreen({ onTeamLogin, onAdminLogin }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'team' | 'admin'>('team');
  const [adminMode, setAdminMode] = useState<'login' | 'register' | 'reset'>('login');
  const [resetSent, setResetSent] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [gameKey, setGameKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [loginStep, setLoginStep] = useState<'key' | 'fields'>('key');
  const [joinCode, setJoinCode] = useState('');
  const [memberName, setMemberName] = useState('');
  const [isRemoteMode, setIsRemoteMode] = useState(false);

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get('key');
    if (key) setGameKey(key.toUpperCase());
  }, []);

  async function handleGameKeyNext() {
    setError('');
    if (!gameKey.trim()) { setError(t('login.errGameKey')); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('games')
        .select('remote_mode')
        .eq('game_key', gameKey.trim().toUpperCase())
        .is('deleted_at', null)
        .single();
      setIsRemoteMode(!!(data?.remote_mode));
    } catch {
      setIsRemoteMode(false);
    } finally {
      setLoading(false);
    }
    setLoginStep('fields');
  }

  async function handleTeamLogin() {
    setError('');
    if (!teamName.trim()) { setError(t('login.errTeamName')); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/team/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName.trim(),
          gameKey: gameKey.trim(),
          joinCode: joinCode.trim() || undefined,
          memberName: memberName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      onTeamLogin(data.team, data.game, data.customMissions ?? [], data.memberId, data.memberName);
    } catch {
      setError(t('login.errNetwork'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin() {
    setError('');
    if (!email.trim()) { setError(t('login.errEnterEmail')); return; }
    if (!password) { setError(t('login.errEnterPassword')); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) { setError(authError.message); return; }
      onAdminLogin();
    } catch {
      setError(t('login.errNetwork'));
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminRegister() {
    setError('');
    if (!email.trim()) { setError(t('login.errEnterEmail')); return; }
    if (!password) { setError(t('login.errEnterPasswordNew')); return; }
    if (password !== confirmPassword) { setError(t('login.errPasswordMatch')); return; }
    if (password.length < 6) { setError(t('login.errPasswordLength')); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signUp({ email: email.trim(), password });
      if (authError) { setError(authError.message); return; }
      // Auto-sign in after register
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) { setError(t('login.errAccountCreated')); setAdminMode('login'); return; }
      onAdminLogin();
    } catch {
      setError(t('login.errNetwork'));
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    setError('');
    if (!email.trim()) { setError(t('login.errEnterEmail')); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/play?reset=true`,
      });
      if (authError) { setError(authError.message); return; }
      setResetSent(true);
    } catch {
      setError(t('login.errNetwork'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 10 }}>
        <LanguagePicker />
      </div>
      <div style={{ width: '100%', maxWidth: '480px', padding: '20px', position: 'relative', zIndex: 1 }} className="fade-in">
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <GameOnLogo size={58} />
          <p style={{ color: 'var(--muted)', marginTop: '12px', fontSize: '14px' }}>{t('login.role')}</p>
        </div>

        <div className="login-tabs">
          <button className={`tab-btn${mode === 'team' ? ' active' : ''}`} onClick={() => { setMode('team'); setError(''); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
            <Users size={15} /> {t('login.tabTeam')}
          </button>
          <button className={`tab-btn${mode === 'admin' ? ' active' : ''}`} onClick={() => { setMode('admin'); setError(''); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
            <ShieldCheck size={15} /> {t('login.tabAdmin')}
          </button>
        </div>

        <div className="card">
          {mode === 'team' ? (
            <>
              {loginStep === 'key' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">{t('login.gameKeyLabel')}</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                      <input
                        type="text"
                        placeholder={t('login.gameKeyPlaceholder')}
                        maxLength={6}
                        value={gameKey}
                        onChange={e => setGameKey(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && handleGameKeyNext()}
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
                    {error && <p className="error-msg">{error}</p>}
                  </div>
                  {showScanner && (
                    <QrScanner
                      onScan={(key) => { setGameKey(key.slice(0, 6)); setShowScanner(false); }}
                      onClose={() => setShowScanner(false)}
                    />
                  )}
                  <button className="btn btn-primary btn-full" onClick={handleGameKeyNext} disabled={loading}>
                    {loading ? '...' : 'Next →'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <button
                      type="button"
                      onClick={() => { setLoginStep('key'); setError(''); setTeamName(''); setJoinCode(''); setMemberName(''); }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: "'Sora', sans-serif" }}
                    >
                      ← {gameKey}
                    </button>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('login.teamNameLabel')}</label>
                    <input
                      type="text"
                      placeholder={t('login.teamNamePlaceholder')}
                      maxLength={20}
                      value={teamName}
                      onChange={e => setTeamName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleTeamLogin()}
                    />
                  </div>
                  {isRemoteMode && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Team code</label>
                        <input
                          type="text"
                          placeholder="X7K2"
                          maxLength={4}
                          value={joinCode}
                          onChange={e => setJoinCode(e.target.value.toUpperCase())}
                          onKeyDown={e => e.key === 'Enter' && handleTeamLogin()}
                          style={{ letterSpacing: '6px', fontSize: '22px', fontFamily: 'monospace', textTransform: 'uppercase' }}
                        />
                        <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>Same code for everyone on your team — decide it together.</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Your name</label>
                        <input
                          type="text"
                          placeholder="First name"
                          maxLength={20}
                          value={memberName}
                          onChange={e => setMemberName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleTeamLogin()}
                        />
                      </div>
                    </>
                  )}
                  {error && (
                    error.includes('5-team limit') ? (
                      <div style={{ marginTop: '12px', padding: '14px 16px', background: 'rgba(124,189,212,0.08)', border: '1px solid rgba(124,189,212,0.25)', borderRadius: '10px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#7CBDD4', marginBottom: '4px' }}>{t('login.errFreePlanTitle')}</p>
                        <p style={{ fontSize: '12px', color: 'var(--muted, #8FA8C0)', lineHeight: 1.5 }}>{t('login.errFreePlanBody')}</p>
                      </div>
                    ) : (
                      <p className="error-msg">{error}</p>
                    )
                  )}
                  <button className="btn btn-primary btn-full" onClick={handleTeamLogin} disabled={loading}>
                    {loading ? t('login.joiningButton') : t('login.joinButton')}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {adminMode === 'reset' ? (
                <>
                  {resetSent ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><MailCheck size={32} color="#7CBDD4" /></div>
                      <p style={{ fontWeight: 700, color: '#DCE4EE', marginBottom: '8px' }}>{t('login.checkEmailTitle')}</p>
                      <p style={{ fontSize: '13px', color: 'var(--muted, #8FA8C0)', lineHeight: 1.6 }}>{t('login.checkEmailDesc', { email })}</p>
                      <button type="button" onClick={() => { setAdminMode('login'); setResetSent(false); }} style={{ marginTop: '20px', background: 'none', border: 'none', color: 'var(--accent, #7CBDD4)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}>{t('login.backToLogin')}</button>
                    </div>
                  ) : (
                    <>
                      <p style={{ fontSize: '13px', color: 'var(--muted, #8FA8C0)', marginBottom: '20px' }}>{t('login.resetEmailDesc')}</p>
                      <div className="form-group">
                        <label className="form-label">{t('login.emailLabel')}</label>
                        <input
                          type="email"
                          placeholder={t('login.emailPlaceholder')}
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handlePasswordReset()}
                        />
                      </div>
                      {error && <p className="error-msg" style={{ marginBottom: '12px' }}>{error}</p>}
                      <button className="btn btn-primary btn-full" onClick={handlePasswordReset} disabled={loading}>
                        {loading ? '...' : t('login.sendResetButton')}
                      </button>
                      <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <button type="button" onClick={() => { setAdminMode('login'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--muted, #8FA8C0)', fontSize: '13px', cursor: 'pointer', fontFamily: "'Sora', sans-serif" }}>{t('login.backToLogin')}</button>
                      </div>
                    </>
                  )}
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
                    <label className="form-label">{t('login.emailLabel')}</label>
                    <input
                      type="email"
                      placeholder={t('login.emailPlaceholder')}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (adminMode === 'login' ? handleAdminLogin() : handleAdminRegister())}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('login.passwordLabel')}</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (adminMode === 'login' ? handleAdminLogin() : handleAdminRegister())}
                    />
                  </div>
                  {adminMode === 'login' && (
                    <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '8px' }}>
                      <button
                        type="button"
                        onClick={() => { setAdminMode('reset'); setError(''); setResetSent(false); }}
                        style={{ background: 'none', border: 'none', color: 'var(--accent, #7CBDD4)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: "'Sora', sans-serif" }}
                      >
                        {t('login.forgotPassword')}
                      </button>
                    </div>
                  )}
                  {adminMode === 'register' && (
                    <div className="form-group">
                      <label className="form-label">{t('login.confirmPasswordLabel')}</label>
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
                    {loading ? '...' : adminMode === 'login' ? t('login.logInButton') : t('login.registerButton')}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
