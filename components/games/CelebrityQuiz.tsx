'use client';
import { useState } from 'react';
import { CelebRound } from '@/lib/missions';

type Props = {
  rounds: CelebRound[];
  maxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

type Selection = { forIdx: number; opt: string; revealing: boolean };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function CelebrityQuiz({ rounds, maxPts, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [shuffledRounds] = useState(() => rounds.map(r => ({ ...r, options: shuffle(r.options) })));

  const active = selection?.forIdx === idx ? selection : null;

  function choose(opt: string) {
    if (active) return;
    const isCorrect = opt === rounds[idx].answer;
    if (isCorrect) setCorrect(c => c + 1);

    setSelection({ forIdx: idx, opt, revealing: true });

    setTimeout(() => {
      if (idx + 1 >= rounds.length) {
        const total = isCorrect ? correct + 1 : correct;
        const pts = Math.round((total / rounds.length) * maxPts);
        onFinish(total > 0, pts);
      } else {
        setSelection(null);
        setIdx(i => i + 1);
      }
    }, 1000);
  }

  const r = shuffledRounds[idx];

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

      <div key={idx} className="options-grid">
        {r.options.map((opt, i) => {
          let cls = 'option-btn';
          if (active?.revealing) {
            if (opt === r.answer) cls += ' correct';
            else if (opt === active.opt) cls += ' wrong';
          } else if (active?.opt === opt) {
            cls += ' selected';
          }
          return (
            <button key={`${idx}-${i}`}
              className={cls}
              disabled={!!active}
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
