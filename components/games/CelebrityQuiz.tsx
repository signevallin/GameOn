'use client';
import { useState } from 'react';
import { CelebRound } from '@/lib/missions';

type Props = {
  rounds: CelebRound[];
  maxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

type Selection = { opt: string };

function OptionsGrid({ options, answer, selection, onChoose }: {
  options: string[];
  answer: string;
  selection: Selection | null;
  onChoose: (opt: string) => void;
}) {
  return (
    <div className="options-grid">
      {options.map((opt, i) => {
        let cls = 'option-btn';
        if (selection) {
          if (opt === answer) cls += ' correct';
          else if (opt === selection.opt) cls += ' wrong';
        }
        return (
          <button
            key={i}
            className={cls}
            disabled={!!selection}
            onClick={() => onChoose(opt)}
            style={{ textAlign: 'center' }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// idx and selection are merged into one state object so they always update
// in a single React commit — no batching needed, no intermediate renders.
type QState = { idx: number; selection: Selection | null };

export default function CelebrityQuiz({ rounds, maxPts, onFinish }: Props) {
  const [{ idx, selection }, setQ] = useState<QState>({ idx: 0, selection: null });
  const [correct, setCorrect] = useState(0);
  const [shuffledRounds] = useState(() => rounds.map(r => ({ ...r, options: shuffle(r.options) })));

  function choose(opt: string) {
    if (selection) return;
    const isCorrect = opt === rounds[idx].answer;
    if (isCorrect) setCorrect(c => c + 1);

    setQ(s => ({ ...s, selection: { opt } }));

    setTimeout(() => {
      if (idx + 1 >= rounds.length) {
        const total = isCorrect ? correct + 1 : correct;
        const pts = Math.round((total / rounds.length) * maxPts);
        onFinish(total > 0, pts);
      } else {
        // Single state update: idx advances AND selection clears in one render.
        setQ({ idx: idx + 1, selection: null });
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

      {/* key={idx} guarantees a full unmount when the question changes,
          AND the selection prop is null in the same render — double protection. */}
      <OptionsGrid key={idx} options={r.options} answer={r.answer} selection={selection} onChoose={choose} />
    </>
  );
}
