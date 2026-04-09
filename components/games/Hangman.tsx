'use client';
import { useState } from 'react';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const FRAMES = ['😶', '😮', '😨', '😰', '😱', '💀', '☠️'];
const MAX_WRONG = 6;

type Props = { word: string; hint: string; onFinish: (correct: boolean) => void };

export default function Hangman({ word, hint, onFinish }: Props) {
  const upper = word.toUpperCase();
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const wrong = [...guessed].filter(l => !upper.includes(l)).length;
  const won = upper.split('').every(c => guessed.has(c));
  const lost = wrong >= MAX_WRONG;

  const display = upper.split('').map(c => (guessed.has(c) ? c : '_')).join(' ');

  function guess(l: string) {
    if (guessed.has(l) || won || lost) return;
    setGuessed(new Set([...guessed, l]));
  }

  return (
    <>
      <div className="challenge-question">{hint}</div>
      <div style={{ textAlign: 'center', margin: '20px 0' }}>
        <div style={{ fontSize: '56px' }}>{FRAMES[wrong]}</div>
        <div style={{ fontSize: '8px', color: 'var(--muted)', marginTop: '4px' }}>{wrong}/{MAX_WRONG} wrong</div>
      </div>
      <div style={{
        fontFamily: "'Sora', sans-serif",
        fontSize: '28px',
        letterSpacing: '8px',
        textAlign: 'center',
        marginBottom: '24px',
        color: won ? 'var(--accent3)' : lost ? 'var(--accent2)' : 'var(--text)',
      }}>
        {display}
      </div>
      {(won || lost) ? (
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <p style={{ color: won ? 'var(--accent3)' : 'var(--accent2)', fontSize: '14px', marginBottom: '16px' }}>
            {won ? `🎉 Correct! The word was ${upper}` : `💀 Game over! The word was ${upper}`}
          </p>
          <button className="btn btn-primary" onClick={() => onFinish(won)}>
            {won ? 'CLAIM POINTS →' : 'CONTINUE →'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
          {ALPHABET.map(l => {
            const used = guessed.has(l);
            const isWrong = used && !upper.includes(l);
            return (
              <button
                key={l}
                disabled={used}
                onClick={() => guess(l)}
                style={{
                  width: '36px', height: '36px', borderRadius: '6px',
                  fontFamily: "'Sora', sans-serif", fontSize: '13px', fontWeight: 700,
                  border: '1px solid var(--border)', cursor: used ? 'default' : 'pointer',
                  background: isWrong ? 'rgba(208,117,125,0.15)' : used ? 'rgba(140,191,155,0.10)' : 'var(--surface)',
                  color: isWrong ? 'var(--accent2)' : used ? 'var(--accent3)' : 'var(--text)',
                  transition: 'all 0.15s',
                }}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
