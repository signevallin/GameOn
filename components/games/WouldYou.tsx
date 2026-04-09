'use client';
import { useState } from 'react';

type Props = { question: string; maxPts: number; onFinish: (correct: boolean, pts: number) => void };

export default function WouldYou({ question, maxPts, onFinish }: Props) {
  const [voted, setVoted] = useState<string | null>(null);
  const [input, setInput] = useState('');

  function submit() {
    if (!input.trim()) return;
    setVoted(input.trim());
  }

  if (voted) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>😂</div>
        <p style={{ fontFamily: "'Sora', sans-serif", fontSize: '14px', color: 'var(--accent)', marginBottom: '8px' }}>
          You voted for:
        </p>
        <p style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px' }}>{voted}</p>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>
          No right or wrong answers – just honest ones! 😄
        </p>
        <button className="btn btn-primary" onClick={() => onFinish(true, maxPts)}>
          CLAIM {maxPts} POINTS →
        </button>
      </div>
    );
  }

  return (
    <>
      <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '20px' }}>🎯</div>
      <div className="challenge-question" style={{ textAlign: 'center', fontSize: '18px', marginBottom: '32px' }}>
        {question}
      </div>
      <div className="form-group">
        <label className="form-label">Write a name from your team</label>
        <input
          type="text"
          placeholder="E.g. Anna"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
      </div>
      <button className="btn btn-primary btn-full" onClick={submit}>VOTE! →</button>
    </>
  );
}
