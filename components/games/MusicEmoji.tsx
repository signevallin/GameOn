'use client';
import { useRef, useState } from 'react';
import { EmojiRound } from '@/lib/missions';

type Props = {
  rounds: EmojiRound[];
  maxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

// Selection state lives entirely inside this keyed component.
// When `key` changes (idx advances), React fully unmounts → fresh state, no bleed.
function EmojiOptions({ options, answer, onChoose }: {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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

export default function MusicEmoji({ rounds, maxPts, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
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

  const r = rounds[idx];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px' }}>
          ROUND {idx + 1} / {rounds.length}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--accent)' }}>
          {correct} correct
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ fontSize: '56px', marginBottom: '12px', letterSpacing: '8px' }}>{r.emojis}</div>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>What does this represent?</p>
      </div>

      <EmojiOptions key={idx} options={r.options} answer={r.answer} onChoose={choose} />
    </>
  );
}
