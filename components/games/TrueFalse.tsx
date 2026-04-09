'use client';
import { useState } from 'react';
import { Statement } from '@/lib/missions';

type Props = { statements: Statement[]; onFinish: (correct: boolean) => void };

export default function TrueFalse({ statements, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<boolean | null>(null);

  function answer(val: boolean) {
    if (flash !== null) return;
    const correct = val === statements[idx].answer;
    setFlash(correct);
    if (correct) setScore(s => s + 1);
    setTimeout(() => {
      setFlash(null);
      if (idx + 1 >= statements.length) {
        onFinish(true);
      } else {
        setIdx(i => i + 1);
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
      <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--muted)' }}>Score: {score}/{idx}</p>
    </div>
  );
}
