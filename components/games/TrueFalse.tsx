'use client';
import { useState, useEffect } from 'react';
import { Statement } from '@/lib/missions';

type Props = {
  statements: Statement[];
  maxPts?: number;
  remoteRoundIdx?: number;
  onRoundAdvance?: (idx: number) => void;
  onClearRound?: () => void;
  onFinish: (correct: boolean, pts?: number) => void;
};

const CheckIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function TrueFalse({ statements, maxPts = 150, remoteRoundIdx, onRoundAdvance, onClearRound, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<boolean | null>(null);

  useEffect(() => {
    if (remoteRoundIdx !== undefined && remoteRoundIdx > idx) {
      setFlash(statements[idx].answer);
      setTimeout(() => {
        setIdx(remoteRoundIdx);
        setFlash(null);
      }, 700);
    }
  // idx/statements deliberately omitted — we only want to react to incoming remote changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteRoundIdx]);

  function answer(val: boolean) {
    if (flash !== null) return;
    const correct = val === statements[idx].answer;
    setFlash(correct);
    const newScore = correct ? score + 1 : score;
    if (correct) setScore(newScore);
    setTimeout(() => {
      setFlash(null);
      if (idx + 1 >= statements.length) {
        onClearRound?.();
        const pts = Math.round(maxPts * (newScore / statements.length));
        onFinish(newScore > 0, pts);
      } else {
        const nextIdx = idx + 1;
        setIdx(nextIdx);
        onRoundAdvance?.(nextIdx);
      }
    }, 700);
  }

  if (idx >= statements.length) return null;

  const s = statements[idx];

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '16px' }}>
        QUESTION {idx + 1} / {statements.length}
      </div>
      <div className="challenge-question" style={{ fontSize: '18px', textAlign: 'center', marginBottom: '32px', lineHeight: '1.5' }}>
        &ldquo;{s.text}&rdquo;
      </div>

      {flash !== null && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
          background: flash ? 'rgba(140,191,155,0.20)' : 'rgba(208,117,125,0.20)',
          zIndex: 10,
        }}>
          <div style={{
            width: '72px', height: '72px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: flash ? 'rgba(140,191,155,0.30)' : 'rgba(208,117,125,0.30)',
            color: flash ? 'var(--accent3)' : 'var(--accent2)',
          }}>
            {flash ? <CheckIcon /> : <XIcon />}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <button
          onClick={() => answer(true)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '10px', padding: '28px 16px', borderRadius: '14px', border: '2px solid var(--border)',
            background: 'var(--surface)', cursor: 'pointer', color: 'var(--accent3)',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent3)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(140,191,155,0.08)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; }}
        >
          <CheckIcon />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1.5px', fontFamily: "'Sora', sans-serif" }}>TRUE</span>
        </button>
        <button
          onClick={() => answer(false)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '10px', padding: '28px 16px', borderRadius: '14px', border: '2px solid var(--border)',
            background: 'var(--surface)', cursor: 'pointer', color: 'var(--accent2)',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent2)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(208,117,125,0.08)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; }}
        >
          <XIcon />
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '1.5px', fontFamily: "'Sora', sans-serif" }}>FALSE</span>
        </button>
      </div>
      <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--muted)' }}>Score: {score}/{idx + 1}</p>
    </div>
  );
}
