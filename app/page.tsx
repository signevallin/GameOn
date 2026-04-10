'use client';
import { useState, useEffect } from 'react';
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
    } catch {
      // Corrupted storage – start fresh
    }
    setHydrated(true);
  }, []);

  // ── Persist session whenever screen / team / game change ──
  useEffect(() => {
    if (!hydrated) return;
    if (screen === 'admin') {
      localStorage.setItem('gameon_screen', 'admin');
      localStorage.removeItem('gameon_team');
      localStorage.removeItem('gameon_game');
    } else if ((screen === 'missions' || screen === 'challenge' || screen === 'result') && team && game) {
      // Always save as 'missions' so a refresh lands back on the mission list
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

  // Don't render anything until we've checked localStorage (avoids flash of login screen)
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
