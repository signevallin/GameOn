'use client';
import { useRef, useState } from 'react';
import { CelebRound } from '@/lib/missions';

type Props = {
  rounds: CelebRound[];
  maxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

// Selection state lives entirely inside this keyed component.
// When `key` changes (idx advances), React fully unmounts → fresh state, no bleed.
function OptionsGrid({ options, answer, onChoose }: {
  options: string[];
  answer: string;
  onChoose: (opt: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  function handleClick(opt: string) {
    if (selected !== null) return;
    setSelected(opt);
    onChoose(opt);
  }

  return (
    <div className="options-grid">
      {options.map((opt, i) => {
        let cls = 'option-btn';
        if (selected !== null) {
          if (opt === answer) cls += ' correct';
          else if (opt === selected) cls += ' wrong';
        }
        return (
          <button key={i} className={cls} disabled={selected !== null} onClick={() => handleClick(opt)} style={{ textAlign: 'center' }}>
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

export default function CelebrityQuiz({ rounds, maxPts, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [shuffledRounds] = useState(() => rounds.map(r => ({ ...r, options: shuffle(r.options) })));
  const advancingRef = useRef(false);

  function choose(opt: string) {
    if (advancingRef.current) return;
    advancingRef.current = true;
    const isCorrect = opt === rounds[idx].answer;
    if (isCorrect) setCorrect(c => c + 1);

    setTimeout(() => {
      advancingRef.current = false;
      if (idx + 1 >= rounds.length) {
        const total = isCorrect ? correct + 1 : correct;
        const pts = Math.round((total / rounds.length) * maxPts);
        onFinish(total > 0, pts);
      } else {
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

      <OptionsGrid key={idx} options={r.options} answer={r.answer} onChoose={choose} />
    </>
  );
}
