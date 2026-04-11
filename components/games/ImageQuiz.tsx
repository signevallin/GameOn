'use client';
import { useState, useEffect, useRef } from 'react';
import { ImageRound } from '@/lib/missions';

type Selection = { forIdx: number; opt: string; revealing: boolean };

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

export default function ImageQuiz({ rounds, maxPts, onFinish }: Props) {
  const [shuffledRounds] = useState(() => rounds.map(r => ({ ...r, options: shuffle(r.options) })));
  const [idx, setIdx] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [totalPts, setTotalPts] = useState(0);
  const [imgError, setImgError] = useState(false);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    setImgError(false);
  }, [idx]);

  const round = shuffledRounds[idx];
  const active = selection?.forIdx === idx ? selection : null;

  function pick(opt: string) {
    if (active?.revealing) return;
    const elapsed = (Date.now() - startRef.current) / 1000;
    const ratio = Math.max(0, 1 - elapsed / 30);
    const ptsPerRound = Math.round(maxPts / rounds.length);
    const pts = opt === round.answer
      ? Math.round(ptsPerRound * 0.4 + ptsPerRound * 0.6 * ratio)
      : 0;
    setSelection({ forIdx: idx, opt, revealing: true });
    setTotalPts(p => p + pts);
    setTimeout(() => {
      if (idx + 1 >= shuffledRounds.length) {
        onFinish(totalPts + pts > 0, totalPts + pts);
      } else {
        setIdx(i => i + 1);
        setSelection(null);
      }
    }, 1200);
  }

  function optClass(opt: string) {
    if (!active) return 'option-btn';
    if (opt === round.answer) return 'option-btn correct';
    if (opt === active.opt) return 'option-btn wrong';
    return 'option-btn';
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

      <div className="options-grid">
        {round.options.map(opt => (
          <button key={opt} className={optClass(opt)} onClick={() => pick(opt)} disabled={!!active}>
            {opt}
          </button>
        ))}
      </div>
    </>
  );
}
