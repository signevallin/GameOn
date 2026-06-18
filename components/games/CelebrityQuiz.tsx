'use client';
import { useState, useEffect } from 'react';
import { CelebRound } from '@/lib/missions';

type Props = {
  rounds: CelebRound[];
  maxPts: number;
  remoteRoundIdx?: number;
  onRoundAdvance?: (idx: number) => void;
  onClearRound?: () => void;
  onFinish: (correct: boolean, pts: number) => void;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function CelebrityQuiz({ rounds, maxPts, remoteRoundIdx, onRoundAdvance, onClearRound, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [shuffledRounds] = useState(() => rounds.map(r => ({ ...r, options: shuffle(r.options) })));
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (remoteRoundIdx !== undefined && remoteRoundIdx > idx && !done) {
      setSelected(shuffledRounds[idx].answer);
      setTimeout(() => {
        setIdx(remoteRoundIdx);
        setSelected(null);
      }, 1000);
    }
  // idx/shuffledRounds deliberately omitted — we only want to react to incoming remote changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteRoundIdx]);

  function choose(opt: string) {
    if (selected !== null) return;
    const isCorrect = opt === shuffledRounds[idx].answer;
    if (isCorrect) setCorrect(c => c + 1);
    setSelected(opt);

    setTimeout(() => {
      if (idx + 1 >= rounds.length) {
        const total = isCorrect ? correct + 1 : correct;
        const pts = Math.round((total / rounds.length) * maxPts);
        setSelected(null);
        setDone(true);
        onClearRound?.();
        onFinish(total > 0, pts);
      } else {
        const nextIdx = idx + 1;
        setSelected(null);
        setIdx(nextIdx);
        onRoundAdvance?.(nextIdx);
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

      {/* key forces full unmount+remount when question changes — guarantees no visual bleed */}
      <div key={`q-${idx}`} className="options-grid">
        {r.options.map((opt, i) => {
          let cls = 'option-btn';
          if (selected !== null) {
            if (opt === r.answer) cls += ' correct';
            else if (opt === selected) cls += ' wrong';
          }
          return (
            <button key={i} className={cls} disabled={selected !== null} onClick={() => choose(opt)} style={{ textAlign: 'center' }}>
              {opt}
            </button>
          );
        })}
      </div>
    </>
  );
}
