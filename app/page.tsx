'use client';
import { useState } from 'react';
import { Team } from '@/lib/supabase';
import LoginScreen from '@/components/screens/LoginScreen';
import MissionsScreen from '@/components/screens/MissionsScreen';
import ChallengeScreen from '@/components/screens/ChallengeScreen';
import ResultScreen from '@/components/screens/ResultScreen';
import AdminScreen from '@/components/screens/AdminScreen';

type Screen = 'login' | 'missions' | 'challenge' | 'result' | 'admin';

type ResultState = {
  missionId: string;
  pts: number;
  correct: boolean;
  elapsed: number;
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>('login');
  const [team, setTeam] = useState<Team | null>(null);
  const [activeMission, setActiveMission] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);

  function handleTeamLogin(t: Team) {
    setTeam(t);
    setScreen('missions');
  }

  function handleAdminLogin() {
    setScreen('admin');
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

  function handleLogout() {
    setTeam(null);
    setScreen('login');
  }

  if (screen === 'login') {
    return <LoginScreen onTeamLogin={handleTeamLogin} onAdminLogin={handleAdminLogin} />;
  }

  if (screen === 'missions' && team) {
    return (
      <MissionsScreen
        team={team}
        onSelectMission={handleSelectMission}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === 'challenge' && team && activeMission) {
    return (
      <ChallengeScreen
        missionId={activeMission}
        team={team}
        onDone={handleChallengeDone}
        onBack={() => setScreen('missions')}
      />
    );
  }

  if (screen === 'result' && team && result) {
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
