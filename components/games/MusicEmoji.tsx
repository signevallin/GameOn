'use client';
import { useState } from 'react';
import { EmojiRound } from '@/lib/missions';

type Props = {
  rounds: EmojiRound[];
  maxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

export default function MusicEmoji({ rounds, maxPts, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  function choose(opt: string) {
    if (selected !== null) return;
    setSelected(opt);
    const isCorrect = opt === rounds[idx].answer;
    if (isCorrect) setCorrect(c => c + 1);

    setTimeout(() => {
      if (idx + 1 >= rounds.length) {
        const total = isCorrect ? correct + 1 : correct;
        const pts = Math.round((total / rounds.length) * maxPts);
        onFinish(total > 0, pts);
      } else {
        setIdx(i => i + 1);
        setSelected(null);
      }
    }, 900);
  }

  const r = rounds[idx];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px' }}>
          SONG {idx + 1} / {rounds.length}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--accent)' }}>
          {correct} correct
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ fontSize: '56px', marginBottom: '12px', letterSpacing: '8px' }}>{r.emojis}</div>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>What does this represent?</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {r.options.map((opt, i) => (
          <button key={i}
            className={`option-btn${selected === opt ? ' selected' : ''}`}
            disabled={selected !== null}
            onClick={() => choose(opt)}
            style={{ textAlign: 'center' }}>
            {opt}
          </button>
        ))}
      </div>
    </>
  );
}
