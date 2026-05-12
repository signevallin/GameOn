'use client';
import { useEffect, useRef, useState } from 'react';

export type TextQuizRound = { question: string; answer: string; aliases?: string[] };

type Props = {
  rounds: TextQuizRound[];
  maxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9åäö]/g, '');
}

export default function TextQuiz({ rounds, maxPts, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [idx]);

  function resolve(isCorrect: boolean) {
    const newCorrect = correctCount + (isCorrect ? 1 : 0);
    setResult(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) setCorrectCount(newCorrect);

    setTimeout(() => {
      if (idx + 1 >= rounds.length) {
        const pts = Math.round((newCorrect / rounds.length) * maxPts);
        onFinish(newCorrect > 0, pts);
      } else {
        setIdx(i => i + 1);
        setGuess('');
        setResult(null);
      }
    }, 1500);
  }

  function submit() {
    if (result !== null || guess.trim() === '') return;
    const n = normalize(guess);
    const r = rounds[idx];
    const isCorrect = n === normalize(r.answer) || (r.aliases ?? []).some(a => n === normalize(a));
    resolve(isCorrect);
  }

  function pass() {
    if (result !== null) return;
    setGuess('');
    resolve(false);
  }

  const r = rounds[idx];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px' }}>
          QUESTION {idx + 1} / {rounds.length}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--accent)' }}>
          {correctCount} correct
        </div>
      </div>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '24px',
        fontSize: '16px',
        fontWeight: 700,
        lineHeight: 1.5,
      }}>
        {r.question}
      </div>

      {result !== null ? (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          borderRadius: '12px',
          background: result === 'correct' ? 'rgba(140,191,155,0.12)' : 'rgba(208,117,125,0.10)',
          border: `1px solid ${result === 'correct' ? 'var(--accent3)' : 'var(--accent2)'}`,
        }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>{result === 'correct' ? '✅' : '❌'}</div>
          <div style={{ fontWeight: 800, fontSize: '16px', color: result === 'correct' ? 'var(--accent3)' : 'var(--accent2)' }}>
            {result === 'correct' ? 'Correct!' : `Wrong — the answer was "${r.answer}"`}
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
            <input
              ref={inputRef}
              type="text"
              value={guess}
              onChange={e => setGuess(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Your answer..."
              style={{ flex: 1 }}
              autoComplete="off"
            />
            <button className="btn btn-primary" onClick={submit} style={{ flexShrink: 0 }}>
              →
            </button>
          </div>
          <button
            onClick={pass}
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              background: 'transparent',
              color: 'var(--muted)',
              fontSize: '12px',
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              letterSpacing: '1px',
              cursor: 'pointer',
            }}
          >
            PASS →
          </button>
        </>
      )}
    </>
  );
}
