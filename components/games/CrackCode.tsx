'use client';
import { useState } from 'react';

type Clue = { digits: [number, number, number]; hint: string };

type Props = {
  clues: Clue[];
  answer: string; // e.g. "394"
  onFinish: (correct: boolean) => void;
};

export default function CrackCode({ clues, answer, onFinish }: Props) {
  const [digits, setDigits] = useState(['', '', '']);
  const [submitted, setSubmitted] = useState(false);
  const [wrong, setWrong] = useState(false);

  function setDigit(i: number, val: string) {
    const d = val.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
  }

  function submit() {
    if (digits.some(d => d === '')) return;
    const guess = digits.join('');
    if (guess === answer) {
      setSubmitted(true);
      setTimeout(() => onFinish(true), 600);
    } else {
      setWrong(true);
      setTimeout(() => setWrong(false), 700);
    }
  }

  return (
    <>
      {/* Answer input */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <p style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '12px' }}>ENTER THE CODE</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
          {digits.map((d, i) => (
            <input
              key={i}
              type="number"
              min={0}
              max={9}
              value={d}
              onChange={e => setDigit(i, e.target.value)}
              style={{
                width: '64px',
                height: '72px',
                textAlign: 'center',
                fontSize: '32px',
                fontWeight: 700,
                fontFamily: "'Sora', sans-serif",
                background: submitted ? 'rgba(140,191,155,0.15)' : wrong ? 'rgba(208,117,125,0.15)' : 'var(--surface)',
                border: `2px solid ${submitted ? 'var(--accent3)' : wrong ? 'var(--accent2)' : 'var(--border)'}`,
                borderRadius: '10px',
                color: submitted ? 'var(--accent3)' : wrong ? 'var(--accent2)' : 'var(--text)',
                outline: 'none',
                transition: 'all 0.2s',
                MozAppearance: 'textfield',
              } as React.CSSProperties}
            />
          ))}
        </div>
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={digits.some(d => d === '') || submitted}
          style={{ padding: '10px 28px' }}
        >
          {submitted ? '✓ CORRECT!' : wrong ? 'WRONG – TRY AGAIN' : 'SUBMIT →'}
        </button>
      </div>

      {/* Clues */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {clues.map((clue, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '12px 16px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
          }}>
            {/* Digit boxes */}
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {clue.digits.map((d, j) => (
                <div key={j} style={{
                  width: '36px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'var(--card)',
                  border: '2px solid var(--border)',
                  borderRadius: '6px',
                  fontWeight: 700,
                  fontSize: '18px',
                  fontFamily: "'Sora', sans-serif",
                }}>
                  {d}
                </div>
              ))}
            </div>
            {/* Hint */}
            <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.4, flex: 1 }}>{clue.hint}</p>
          </div>
        ))}
      </div>
    </>
  );
}
