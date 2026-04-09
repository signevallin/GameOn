'use client';
import { useEffect, useRef, useState } from 'react';
import { Mission, calcPoints, MISSIONS } from '@/lib/missions';
import { Team } from '@/lib/supabase';
import MultipleChoice from '@/components/games/MultipleChoice';
import TextInput from '@/components/games/TextInput';
import Puzzle from '@/components/games/Puzzle';
import MemoryGame from '@/components/games/MemoryGame';
import ReactionTest from '@/components/games/ReactionTest';
import TypeRace from '@/components/games/TypeRace';
import Hangman from '@/components/games/Hangman';
import WouldYou from '@/components/games/WouldYou';
import TrueFalse from '@/components/games/TrueFalse';

type Props = {
  missionId: string;
  team: Team;
  onDone: (updatedTeam: Team, pts: number, correct: boolean, elapsed: number) => void;
  onBack: () => void;
};

export default function ChallengeScreen({ missionId, team, onDone, onBack }: Props) {
  const mission = MISSIONS.find(m => m.id === missionId)!;
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(e => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const display = elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  async function finish(correct: boolean, customPts?: number) {
    const pts = correct ? (customPts !== undefined ? customPts : calcPoints(mission, elapsedRef.current)) : 0;

    if (team.completed?.includes(missionId)) {
      onDone(team, 0, correct, elapsedRef.current);
      return;
    }

    try {
      const res = await fetch('/api/team/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id, missionId, points: pts }),
      });
      const data = await res.json();
      onDone(data.team ?? team, pts, correct, elapsedRef.current);
    } catch {
      onDone(team, pts, correct, elapsedRef.current);
    }
  }

  function renderGame() {
    switch (mission.type) {
      case 'multiple_choice':
        return <MultipleChoice mission={mission} onFinish={finish} />;
      case 'text_input':
        return <TextInput mission={mission} onFinish={finish} />;
      case 'puzzle':
        return <Puzzle onFinish={finish} />;
      case 'memory':
        return <MemoryGame onFinish={finish} />;
      case 'reaction':
        return <ReactionTest maxPts={mission.maxPts} missionId={missionId} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'typerace':
        return <TypeRace text={mission.text!} onFinish={finish} />;
      case 'hangman':
        return <Hangman word={mission.word!} hint={mission.hint!} onFinish={finish} />;
      case 'wouldyou':
        return <WouldYou question={mission.question!} maxPts={mission.maxPts} onFinish={(correct, pts) => finish(correct, pts)} />;
      case 'truefalse':
        return <TrueFalse statements={mission.statements!} onFinish={finish} />;
      default:
        return null;
    }
  }

  return (
    <>
      <nav className="nav">
        <div className="nav-brand">{mission.icon} {mission.name}</div>
        <div className="nav-right">
          <span className="nav-score">⭐ {team.score} pts</span>
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onBack}>
            ← MISSIONS
          </button>
        </div>
      </nav>

      <div className="challenge-wrap fade-in">
        <div className="challenge-header">
          <div>
            <h2>{mission.name}</h2>
            <p style={{ color: 'var(--muted)', marginTop: '6px', fontSize: '14px' }}>{mission.desc}</p>
          </div>
          <div className="timer-box">
            <div className="timer-label">Time</div>
            <div className={`timer-value${elapsed > 60 ? ' urgent' : ''}`}>{display}</div>
          </div>
        </div>

        <div className="challenge-card">
          {renderGame()}
        </div>
      </div>
    </>
  );
}
