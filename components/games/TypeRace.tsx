'use client';
import { useEffect, useRef, useState } from 'react';

type Props = { text: string; onFinish: (correct: boolean) => void };

export default function TypeRace({ text, onFinish }: Props) {
  const [typed, setTyped] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleChange(val: string) {
    setTyped(val);
    if (val === text) onFinish(true);
  }

  const pct = Math.round((typed.length / text.length) * 100);

  return (
    <>
      <div className="challenge-question">Type the text below as fast and accurately as possible!</div>
      <div style={{
        fontSize: '20px',
        lineHeight: '1.8',
        fontFamily: "'Sora', sans-serif",
        letterSpacing: '1px',
        marginBottom: '20px',
        background: '#0d1422',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid var(--border)',
      }}>
        {text.split('').map((ch, i) => {
          let color = 'var(--muted)';
          let bg = 'transparent';
          let textDecoration = 'none';
          if (i < typed.length) {
            color = typed[i] === ch ? 'var(--accent3)' : 'var(--accent2)';
            textDecoration = typed[i] !== ch ? 'underline' : 'none';
          } else if (i === typed.length) {
            bg = 'var(--accent)';
            color = '#0a0e19';
          }
          return (
            <span key={i} style={{ color, background: bg, borderRadius: '2px', textDecoration }}>
              {ch}
            </span>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={typed}
        placeholder="Start typing here..."
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={e => handleChange(e.target.value)}
      />
      <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '8px' }}>{pct}% done</p>
    </>
  );
}
