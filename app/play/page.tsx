'use client';
import { useState, useEffect, useRef } from 'react';
import { Team, Game, CustomMission } from '@/lib/supabase';
import { toMission } from '@/lib/custom-missions';
import { Mission } from '@/lib/missions';
import { supabase } from '@/lib/supabase';
import { initI18n } from '@/lib/i18n';
import LoginScreen from '@/components/screens/LoginScreen';
import MissionsScreen from '@/components/screens/MissionsScreen';
import ChallengeScreen from '@/components/screens/ChallengeScreen';
import ResultScreen from '@/components/screens/ResultScreen';
import AdminScreen from '@/components/screens/AdminScreen';
import GameOnLogo from '@/components/GameOnLogo';

type Screen = 'login' | 'missions' | 'challenge' | 'result' | 'admin' | 'resetpw';
type ResultState = { missionId: string; pts: number; correct: boolean; elapsed: number };

export default function Home() {
  const [screen, setScreen] = useState<Screen>('login');
  const [team, setTeam] = useState<Team | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeMission, setActiveMission] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [customMissions, setCustomMissions] = useState<Mission[]>([]);
  const [upgradeToast, setUpgradeToast] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string; online: boolean }>>([]);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [passwordUpdating, setPasswordUpdating] = useState(false);
  const pendingPlanRef = useRef<string | null>(null);

  // Refs so the polling interval always reads the latest values without
  // needing to be in the dependency array (which would restart the interval).
  const teamRef = useRef(team);
  const gameRef = useRef(game);
  teamRef.current = team;
  gameRef.current = game;
  const memberIdRef = useRef<string | null>(null);
  memberIdRef.current = memberId;

  // ── Restore session on first mount ──
  useEffect(() => {
    async function restoreSession() {
      try {
        // 1. Check for Supabase admin session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setScreen('admin');
          setHydrated(true);
          return;
        }
        // 2. Fall back to localStorage for team session
        const savedScreen = localStorage.getItem('gameon_screen') as Screen | null;
        const savedTeam = localStorage.getItem('gameon_team');
        const savedGame = localStorage.getItem('gameon_game');
        if (savedScreen === 'missions' && savedTeam && savedGame) {
          setTeam(JSON.parse(savedTeam));
          setGame(JSON.parse(savedGame));
          setScreen('missions');
          try {
            const savedMember = localStorage.getItem('gameon_member');
            if (savedMember) {
              const m = JSON.parse(savedMember);
              if (m.memberId) { setMemberId(m.memberId); setMemberName(m.memberName ?? null); }
            }
          } catch { /* ignore corrupted member storage */ }
        }
      } catch { /* corrupted storage – start fresh */ }
      setHydrated(true);
    }
    restoreSession();
  }, []);

  // ── Handle PASSWORD_RECOVERY event from Supabase ──
  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setScreen('resetpw');
      }
    });
    return () => authSub.unsubscribe();
  }, []);

  // ── Initialize i18n ──
  useEffect(() => {
    const savedLang = typeof window !== 'undefined' ? localStorage.getItem('gameon_lang') ?? 'en' : 'en';
    initI18n(savedLang).catch(() => {});
  }, []);

  // ── Master polling loop: runs whenever team is on the missions screen ──
  // Lives in page.tsx (the state owner) so there are no prop-stability issues.
  useEffect(() => {
    if (!hydrated) return;

    async function refresh() {
      const t = teamRef.current;
      const g = gameRef.current;
      if (!t || !g) return;
      try {
        // Single combined request — replaces 3 separate API calls
        const res = await fetch('/api/poll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamId: t.id, gameId: g.id, gameKey: g.game_key }),
          cache: 'no-store',
        });
        const data = await res.json();
        if (data.error) { console.error('[poll]', data.error); return; }
        if (data.game) setGame(data.game);
        if (data.team) setTeam(data.team);
        if (data.teams) setTeams(data.teams);
        if (data.members) setMembers(data.members);
        else if (!gameRef.current?.remote_mode) setMembers([]);
      } catch (err) { console.error('[poll] network error:', err); }
    }

    // Poll immediately, then every 5 seconds (reduced from 3s for scalability)
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  // Only restart when the session itself changes (login/logout), not on every state update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, screen === 'missions' || screen === 'challenge' || screen === 'result']);

  // ── Heartbeat: keep remote member presence alive ──────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (screen !== 'missions' && screen !== 'challenge' && screen !== 'result') return;

    async function heartbeat() {
      const mId = memberIdRef.current;
      const g = gameRef.current;
      if (!mId || !g?.remote_mode) return;
      try {
        await fetch('/api/team/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: mId }),
          cache: 'no-store',
        });
      } catch { /* silent — heartbeat is best-effort */ }
    }

    heartbeat(); // immediate on mount
    const id = setInterval(heartbeat, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, screen === 'missions' || screen === 'challenge' || screen === 'result']);

  // ── Read intent from query params on first mount ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get('plan');
    if (plan === 'pro' || plan === 'studio') {
      pendingPlanRef.current = plan;
      // Strip from URL so it doesn't linger
      const url = new URL(window.location.href);
      url.searchParams.delete('plan');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  // ── Handle post-upgrade redirect ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const upgraded = params.get('upgraded');
    if (!upgraded) return;
    const label = upgraded === 'studio' ? 'Studio' : 'Pro';
    setUpgradeToast(`🎉 Welcome to ${label}! Your plan is now active.`);
    // Strip query param from URL without triggering a navigation
    const url = new URL(window.location.href);
    url.searchParams.delete('upgraded');
    window.history.replaceState({}, '', url.toString());
    const timer = setTimeout(() => setUpgradeToast(null), 6000);
    return () => clearTimeout(timer);
  }, []);

  // ── Persist session to localStorage ──
  useEffect(() => {
    if (!hydrated) return;
    if (screen === 'admin') {
      // Admin session managed by Supabase Auth — no localStorage needed
      localStorage.removeItem('gameon_screen');
      localStorage.removeItem('gameon_team');
      localStorage.removeItem('gameon_game');
      localStorage.removeItem('gameon_member');
    } else if ((screen === 'missions' || screen === 'challenge' || screen === 'result') && team && game) {
      localStorage.setItem('gameon_screen', 'missions');
      localStorage.setItem('gameon_team', JSON.stringify(team));
      localStorage.setItem('gameon_game', JSON.stringify(game));
      if (memberId) {
        localStorage.setItem('gameon_member', JSON.stringify({ memberId, memberName }));
      } else {
        localStorage.removeItem('gameon_member');
      }
    } else if (screen === 'login') {
      localStorage.removeItem('gameon_screen');
      localStorage.removeItem('gameon_team');
      localStorage.removeItem('gameon_game');
      localStorage.removeItem('gameon_member');
    }
  }, [screen, team, game, hydrated, memberId, memberName]);

  async function doPasswordUpdate() {
    setNewPasswordError('');
    if (newPassword.length < 6) { setNewPasswordError('Password must be at least 6 characters.'); return; }
    setPasswordUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) { setNewPasswordError(error.message); return; }
      setScreen('admin');
    } catch {
      setNewPasswordError('Network error. Try again.');
    } finally {
      setPasswordUpdating(false);
    }
  }

  async function handleTeamLogin(t: Team, g: Game, cms: CustomMission[] = [], mId?: string, mName?: string) {
    setTeam(t);
    setGame(g);
    setCustomMissions(cms.map(toMission));
    // Initialize i18n with player's saved language, falling back to game default
    const savedLang = localStorage.getItem('gameon_lang');
    const lang = savedLang ?? (g as { language?: string }).language ?? 'en';
    await initI18n(lang);
    if (mId) { setMemberId(mId); setMemberName(mName ?? null); }
    setScreen('missions');
  }

  async function handleAdminLogin() {
    setScreen('admin');
    const plan = pendingPlanRef.current;
    if (!plan) return;
    pendingPlanRef.current = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { /* silently ignore — user can upgrade manually */ }
  }

  function handleSelectMission(id: string) {
    setActiveMission(id);
    setScreen('challenge');
  }

  function handleChallengeDone(updatedTeam: Team, pts: number, correct: boolean, elapsed: number) {
    setTeam(updatedTeam);
    setResult({ missionId: activeMission!, pts, correct, elapsed });
    setScreen('result');
  }

  async function handleLogout() {
    await supabase.auth.signOut().catch(() => {});
    setTeam(null);
    setGame(null);
    setMemberId(null);
    setMemberName(null);
    setMembers([]);
    setScreen('login');
  }

  if (!hydrated) return (
    <div>
      {/* Skeleton nav */}
      <div className="nav" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', alignItems: 'center', gap: '4px' }}>
        <div className="skeleton" style={{ height: '14px', width: '80px', borderRadius: '6px' }} />
        <div className="skeleton" style={{ height: '24px', width: '72px', borderRadius: '20px', margin: '0 auto' }} />
        <div className="skeleton" style={{ height: '14px', width: '48px', borderRadius: '6px', margin: '0 auto' }} />
        <div className="skeleton" style={{ height: '14px', width: '56px', borderRadius: '6px', marginLeft: 'auto' }} />
      </div>
      <div className="container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '32px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '14px' }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '88px', borderRadius: '12px' }} />
          ))}
        </div>
      </div>
    </div>
  );

  if (screen === 'login') {
    return <LoginScreen onTeamLogin={handleTeamLogin} onAdminLogin={handleAdminLogin} />;
  }

  if (screen === 'missions' && team && game) {
    return (
      <MissionsScreen
        team={team}
        game={game}
        teams={teams}
        customMissions={customMissions}
        onSelectMission={handleSelectMission}
        onLogout={handleLogout}
        onTeamUpdate={setTeam}
        onGameUpdate={setGame}
        memberId={memberId ?? undefined}
        members={members}
      />
    );
  }

  if (screen === 'challenge' && team && game && activeMission) {
    return (
      <ChallengeScreen
        missionId={activeMission}
        team={team}
        game={game}
        teams={teams}
        customMissions={customMissions}
        onDone={handleChallengeDone}
        onBack={() => setScreen('missions')}
      />
    );
  }

  if (screen === 'result' && team && game && result) {
    return (
      <ResultScreen
        team={team}
        missionId={result.missionId}
        pts={result.pts}
        correct={result.correct}
        elapsed={result.elapsed}
        onBack={() => setScreen('missions')}
      />
    );
  }

  if (screen === 'admin') {
    return (
      <>
        <AdminScreen onLogout={handleLogout} />
        {upgradeToast && (
          <div style={{
            position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #7CBDD4, #4890aa)', color: '#0D1520',
            padding: '14px 24px', borderRadius: '12px', fontFamily: "'Sora', sans-serif",
            fontWeight: 700, fontSize: '14px', zIndex: 9999,
            boxShadow: '0 8px 32px rgba(124,189,212,0.4)',
            animation: 'fadeInUp 0.3s ease',
          }}>
            {upgradeToast}
          </div>
        )}
      </>
    );
  }

  if (screen === 'resetpw') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '420px', padding: '20px' }} className="fade-in">
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <GameOnLogo size={48} />
            <p style={{ color: 'var(--muted)', marginTop: '12px', fontSize: '14px' }}>Set a new password</p>
          </div>
          <div className="card">
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                onKeyDown={async e => { if (e.key === 'Enter') await doPasswordUpdate(); }}
              />
            </div>
            {newPasswordError && <p className="error-msg" style={{ marginBottom: '12px' }}>{newPasswordError}</p>}
            <button
              className="btn btn-primary btn-full"
              disabled={passwordUpdating}
              onClick={doPasswordUpdate}
            >
              {passwordUpdating ? '...' : 'UPDATE PASSWORD →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
