'use client';
import { useState } from 'react';
import { CelebRound } from '@/lib/missions';

type Props = {
  rounds: CelebRound[];
  maxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

export default function CelebrityQuiz({ rounds, maxPts, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  // selected: what the user clicked; revealing: show correct answer in green
  const [selected, setSelected] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  function choose(opt: string) {
    if (selected !== null) return;
    const isCorrect = opt === rounds[idx].answer;
    if (isCorrect) setCorrect(c => c + 1);
    setSelected(opt);
    setRevealing(true);

    setTimeout(() => {
      if (idx + 1 >= rounds.length) {
        const total = isCorrect ? correct + 1 : correct;
        const pts = Math.round((total / rounds.length) * maxPts);
        onFinish(total > 0, pts);
      } else {
        // Clear both before advancing so nothing bleeds into next question
        setSelected(null);
        setRevealing(false);
        setIdx(i => i + 1);
      }
    }, 1000);
  }

  const r = rounds[idx];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px' }}>
          QUESTION {idx + 1} / {rounds.length}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--accent)' }}>
          {correct} correct
        </div>
      </div>

      <div className="challenge-question" style={{ fontSize: '16px', marginBottom: '28px', lineHeight: '1.6' }}>
        {r.clue}
      </div>

      <div className="options-grid">
        {r.options.map((opt, i) => {
          let cls = 'option-btn';
          if (revealing) {
            if (opt === r.answer) cls += ' correct';
            else if (opt === selected) cls += ' wrong';
          } else if (selected === opt) {
            cls += ' selected';
          }
          return (
            <button key={i}
              className={cls}
              disabled={selected !== null}
              onClick={() => choose(opt)}
              style={{ textAlign: 'center' }}>
              {opt}
            </button>
          );
        })}
      </div>
    </>
  );
}
