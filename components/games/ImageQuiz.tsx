'use client';
import { useEffect, useRef, useState } from 'react';
import { ImageRound } from '@/lib/missions';

type Props = {
  rounds: ImageRound[];
  maxPts: number;
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

type Selection = { opt: string };

function ImageOptions({ options, answer, selection, onPick }: {
  options: string[];
  answer: string;
  selection: Selection | null;
  onPick: (opt: string) => void;
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
          <button key={i} className={cls} disabled={!!selection} onClick={() => onPick(opt)}>
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

export default function ImageQuiz({ rounds, maxPts, onFinish }: Props) {
  const [shuffledRounds] = useState(() => rounds.map(r => ({ ...r, options: shuffle(r.options) })));
  const [{ idx, selection }, setQ] = useState<QState>({ idx: 0, selection: null });
  const [totalPts, setTotalPts] = useState(0);
  const [imgError, setImgError] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setImgError(false);
  }, [idx]);

  const round = shuffledRounds[idx];

  function pick(opt: string) {
    if (selection) return;
    const elapsed = (Date.now() - startRef.current) / 1000;
    const ratio = Math.max(0, 1 - elapsed / 30);
    const ptsPerRound = Math.round(maxPts / rounds.length);
    const pts = opt === round.answer
      ? Math.round(ptsPerRound * 0.4 + ptsPerRound * 0.6 * ratio)
      : 0;
    setTotalPts(p => p + pts);
    setQ(s => ({ ...s, selection: { opt } }));

    setTimeout(() => {
      if (idx + 1 >= shuffledRounds.length) {
        onFinish(totalPts + pts > 0, totalPts + pts);
      } else {
        // Single state update: idx advances AND selection clears in one render.
        setQ({ idx: idx + 1, selection: null });
      }
    }, 1200);
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px' }}>
          {idx + 1} / {shuffledRounds.length}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--accent)' }}>{totalPts} pts</span>
      </div>

      <div style={{
        width: '100%',
        aspectRatio: '16/9',
        background: '#ffffff',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {imgError ? (
          <span style={{ color: '#888', fontSize: '13px' }}>Image not available</span>
        ) : (
          <img
            key={round.imageUrl}
            src={round.imageUrl}
            alt="Guess what this is"
            onError={() => setImgError(true)}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', padding: '16px' }}
          />
        )}
      </div>

      {/* key={idx} guarantees a full unmount when the question changes,
          AND the selection prop is null in the same render — double protection. */}
      <ImageOptions key={idx} options={round.options} answer={round.answer} selection={selection} onPick={pick} />
    </>
  );
}
