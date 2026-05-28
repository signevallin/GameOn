'use client';
import { useState, useEffect, useRef } from 'react';
import { Team, Game, CustomMission } from '@/lib/supabase';
import { toMission } from '@/lib/custom-missions';
import { Mission } from '@/lib/missions';
import { supabase } from '@/lib/supabase';
import LoginScreen from '@/components/screens/LoginScreen';
import MissionsScreen from '@/components/screens/MissionsScreen';
import ChallengeScreen from '@/components/screens/ChallengeScreen';
import ResultScreen from '@/components/screens/ResultScreen';
import AdminScreen from '@/components/screens/AdminScreen';

type Screen = 'login' | 'missions' | 'challenge' | 'result' | 'admin';
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

  // Refs so the polling interval always reads the latest values without
  // needing to be in the dependency array (which would restart the interval).
  const teamRef = useRef(team);
  const gameRef = useRef(game);
  teamRef.current = team;
  gameRef.current = game;

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
        }
      } catch { /* corrupted storage – start fresh */ }
      setHydrated(true);
    }
    restoreSession();
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
      } catch (err) { console.error('[poll] network error:', err); }
    }

    // Poll immediately, then every 5 seconds (reduced from 3s for scalability)
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  // Only restart when the session itself changes (login/logout), not on every state update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, screen === 'missions' || screen === 'challenge' || screen === 'result']);

  // ── Persist session to localStorage ──
  useEffect(() => {
    if (!hydrated) return;
    if (screen === 'admin') {
      // Admin session managed by Supabase Auth — no localStorage needed
      localStorage.removeItem('gameon_screen');
      localStorage.removeItem('gameon_team');
      localStorage.removeItem('gameon_game');
    } else if ((screen === 'missions' || screen === 'challenge' || screen === 'result') && team && game) {
      localStorage.setItem('gameon_screen', 'missions');
      localStorage.setItem('gameon_team', JSON.stringify(team));
      localStorage.setItem('gameon_game', JSON.stringify(game));
    } else if (screen === 'login') {
      localStorage.removeItem('gameon_screen');
      localStorage.removeItem('gameon_team');
      localStorage.removeItem('gameon_game');
    }
  }, [screen, team, game, hydrated]);

  function handleTeamLogin(t: Team, g: Game, cms: CustomMission[] = []) {
    setTeam(t);
    setGame(g);
    setCustomMissions(cms.map(toMission));
    setScreen('missions');
  }

  function handleAdminLogin() { setScreen('admin'); }

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
    return <AdminScreen onLogout={handleLogout} />;
  }

  return null;
}
