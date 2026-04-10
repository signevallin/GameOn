'use client';
import { useState, useEffect, useRef } from 'react';
import { Team, Game } from '@/lib/supabase';
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
  const [activeMission, setActiveMission] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Refs so the polling interval always reads the latest values without
  // needing to be in the dependency array (which would restart the interval).
  const teamRef = useRef(team);
  const gameRef = useRef(game);
  teamRef.current = team;
  gameRef.current = game;

  // ── Restore session from localStorage on first mount ──
  useEffect(() => {
    try {
      const savedScreen = localStorage.getItem('gameon_screen') as Screen | null;
      const savedTeam = localStorage.getItem('gameon_team');
      const savedGame = localStorage.getItem('gameon_game');

      if (savedScreen === 'admin') {
        setScreen('admin');
      } else if (savedScreen === 'missions' && savedTeam && savedGame) {
        setTeam(JSON.parse(savedTeam));
        setGame(JSON.parse(savedGame));
        setScreen('missions');
      }
    } catch { /* corrupted storage – start fresh */ }
    setHydrated(true);
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
      // _t= busts any CDN/edge cache that ignores Cache-Control headers
      const ts = Date.now();
      const [gameRes, teamRes] = await Promise.all([
        fetch(`/api/game?key=${g.game_key}&_t=${ts}`, { cache: 'no-store' }),
        fetch(`/api/team/status?teamId=${t.id}&_t=${ts}`, { cache: 'no-store' }),
      ]);
      const [gameData, teamData] = await Promise.all([gameRes.json(), teamRes.json()]);
      if (gameData.error) console.error('[poll/game]', gameData.error);
      if (teamData.error) console.error('[poll/team]', teamData.error);
      if (gameData.game) setGame(gameData.game);
      if (teamData.team) setTeam(teamData.team);
      } catch (err) { console.error('[poll] network error:', err); }
    }

    // Poll immediately, then every 3 seconds
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  // Only restart when the session itself changes (login/logout), not on every state update.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, screen === 'missions' || screen === 'challenge' || screen === 'result']);

  // ── Persist session to localStorage ──
  useEffect(() => {
    if (!hydrated) return;
    if (screen === 'admin') {
      localStorage.setItem('gameon_screen', 'admin');
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

  function handleTeamLogin(t: Team, g: Game) {
    setTeam(t);
    setGame(g);
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

  function handleLogout() {
    setTeam(null);
    setGame(null);
    setScreen('login');
  }

  if (!hydrated) return null;

  if (screen === 'login') {
    return <LoginScreen onTeamLogin={handleTeamLogin} onAdminLogin={handleAdminLogin} />;
  }

  if (screen === 'missions' && team && game) {
    return (
      <MissionsScreen
        team={team}
        game={game}
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
