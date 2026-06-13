'use client';
import { useState } from 'react';
import { TriviaRound } from '@/lib/missions';
import { useRemoteRoundSync } from '@/hooks/useRemoteRoundSync';

type Props = {
  rounds: TriviaRound[];
  maxPts: number;
  teamId?: string;
  missionId?: string;
  onFinish: (correct: boolean, pts?: number) => void;
};

export default function TriviaQuiz({ rounds, maxPts, teamId, missionId, onFinish }: Props) {
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [totalPts, setTotalPts] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const { broadcastRound, clearRound } = useRemoteRoundSync({
    teamId,
    missionId,
    onRemoteAdvance: (idx) => {
      setQIdx(idx);
      setSelected(null);
    },
  });

  const ptsPerQ = Math.round(maxPts / rounds.length);
  const q = rounds[qIdx];

  function choose(opt: string) {
    if (selected !== null) return;
    setSelected(opt);

    const correct = opt === q.answer;
    const earned = correct ? ptsPerQ : 0;
    const newTotal = totalPts + earned;
    const newCorrect = correctCount + (correct ? 1 : 0);

    setTimeout(() => {
      if (qIdx + 1 >= rounds.length) {
        clearRound();
        setDone(true);
        onFinish(newCorrect === rounds.length, newTotal);
      } else {
        setTotalPts(newTotal);
        setCorrectCount(newCorrect);
        const nextIdx = qIdx + 1;
        setQIdx(nextIdx);
        setSelected(null);
        broadcastRound(nextIdx);
      }
    }, 900);
  }

  if (done) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)', letterSpacing: '2px' }}>
          QUESTION {qIdx + 1}/{rounds.length}
        </span>
        <span style={{ fontWeight: 800, color: 'var(--gold)' }}>{totalPts} pts</span>
      </div>

      <div className="challenge-question">{q.question}</div>

      <div className="options-grid">
        {q.options.map((opt, i) => {
          let cls = 'option-btn';
          if (selected !== null) {
            if (opt === q.answer) cls += ' correct';
            else if (opt === selected) cls += ' wrong';
          } else if (selected === opt) {
            cls += ' selected';
          }
          return (
            <button
              key={i}
              className={cls}
              disabled={selected !== null}
              onClick={() => choose(opt)}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
