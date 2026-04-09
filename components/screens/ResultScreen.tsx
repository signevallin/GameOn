'use client';
import { MISSIONS } from '@/lib/missions';
import { Team } from '@/lib/supabase';

type Props = {
  team: Team;
  missionId: string;
  pts: number;
  correct: boolean;
  elapsed: number;
  onBack: () => void;
};

export default function ResultScreen({ team, missionId, pts, correct, elapsed, onBack }: Props) {
  const mission = MISSIONS.find(m => m.id === missionId);

  return (
    <>
      <nav className="nav">
        <div className="nav-brand">MISSION COMPLETE</div>
        <div className="nav-right">
          <button className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={onBack}>
            ← BACK
          </button>
        </div>
      </nav>

      <div className="result-screen fade-in">
        <span className="result-icon">{correct ? '🎉' : '😬'}</span>
        <h2>{correct ? 'Correct answer!' : 'Wrong answer'}</h2>
        <div className="result-points" style={{ color: correct ? 'var(--accent)' : 'var(--accent2)' }}>
          +{pts}
        </div>
        <div className="result-label">points</div>
        <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '32px' }}>
          {correct
            ? `Solved in ${elapsed} seconds!`
            : `Correct answer was: ${mission?.answer ?? '–'}`}
        </p>
        <p style={{ fontFamily: "'Sora', sans-serif", fontSize: '13px', color: 'var(--accent)', marginBottom: '24px' }}>
          Total score: {team.score} p
        </p>
        <button className="btn btn-primary" onClick={onBack}>MORE MISSIONS →</button>
      </div>
    </>
  );
}
