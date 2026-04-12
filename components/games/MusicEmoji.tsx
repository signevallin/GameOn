'use client';
import { useState } from 'react';
import { EmojiRound } from '@/lib/missions';

type Props = {
  rounds: EmojiRound[];
  maxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

type Selection = { opt: string };

function EmojiOptions({ options, answer, selection, onChoose }: {
  options: string[];
  answer: string;
  selection: Selection | null;
  onChoose: (opt: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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

// idx and selection are merged into one state object so they always update
// in a single React commit — no batching needed, no intermediate renders.
type QState = { idx: number; selection: Selection | null };

export default function MusicEmoji({ rounds, maxPts, onFinish }: Props) {
  const [{ idx, selection }, setQ] = useState<QState>({ idx: 0, selection: null });
  const [correct, setCorrect] = useState(0);

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

      {/* key={idx} guarantees a full unmount when the question changes,
          AND the selection prop is null in the same render — double protection. */}
      <EmojiOptions key={idx} options={r.options} answer={r.answer} selection={selection} onChoose={choose} />
    </>
  );
}
