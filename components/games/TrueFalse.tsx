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

export default function TrueFalse({ statements, maxPts = 150, remoteRoundIdx, onRoundAdvance, onClearRound, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<boolean | null>(null);

  useEffect(() => {
    if (remoteRoundIdx !== undefined && remoteRoundIdx > idx) {
      // Flash the correct answer briefly so remote players see the reveal, then advance.
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
        "{s.text}"
      </div>
      {flash !== null && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '48px', pointerEvents: 'none',
          background: flash ? 'rgba(140,191,155,0.20)' : 'rgba(208,117,125,0.20)',
          zIndex: 10,
        }}>
          {flash ? '✅' : '❌'}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <button className="option-btn" onClick={() => answer(true)} style={{ textAlign: 'center', fontSize: '22px', padding: '24px' }}>
          ✅<br /><span style={{ fontSize: '14px' }}>TRUE</span>
        </button>
        <button className="option-btn" onClick={() => answer(false)} style={{ textAlign: 'center', fontSize: '22px', padding: '24px' }}>
          ❌<br /><span style={{ fontSize: '14px' }}>FALSE</span>
        </button>
      </div>
      <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--muted)' }}>Score: {score}/{idx + 1}</p>
    </div>
  );
}
