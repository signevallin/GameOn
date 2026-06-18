'use client';
import { useState, useRef, useEffect } from 'react';
import { EmojiRound } from '@/lib/missions';

type Props = {
  rounds: EmojiRound[];
  maxPts: number;
  remoteRoundIdx?: number;
  onRoundAdvance?: (idx: number) => void;
  onClearRound?: () => void;
  onFinish: (correct: boolean, pts: number) => void;
};

function normalize(s: string) {
  return s.toLowerCase()
    .replace(/^the\s+/, '')   // strip leading "the"
    .replace(/[^a-z0-9]/g, '');
}

export default function MovieEmoji({ rounds, maxPts, remoteRoundIdx, onRoundAdvance, onClearRound, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [guess, setGuess] = useState('');
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [idx]);

  useEffect(() => {
    if (remoteRoundIdx !== undefined && remoteRoundIdx > idx) {
      setResult('correct');
      setTimeout(() => {
        setIdx(remoteRoundIdx);
        setGuess('');
        setResult(null);
      }, 900);
      return;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteRoundIdx]);

  function resolve(isCorrect: boolean) {
    const newCorrect = correctCount + (isCorrect ? 1 : 0);
    setResult(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) setCorrectCount(newCorrect);

    setTimeout(() => {
      if (idx + 1 >= rounds.length) {
        onClearRound?.();
        const pts = Math.round((newCorrect / rounds.length) * maxPts);
        onFinish(newCorrect > 0, pts);
      } else {
        const nextIdx = idx + 1;
        setIdx(nextIdx);
        setGuess('');
        setResult(null);
        onRoundAdvance?.(nextIdx);
      }
    }, 1500);
  }

  function isCorrectAnswer(g: string, round: EmojiRound) {
    const n = normalize(g);
    if (n === normalize(round.answer)) return true;
    return (round.aliases ?? []).some(a => n === normalize(a));
  }

  function submit() {
    if (result !== null || guess.trim() === '') return;
    resolve(isCorrectAnswer(guess, rounds[idx]));
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
          ROUND {idx + 1} / {rounds.length}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--accent)' }}>
          {correctCount} correct
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ fontSize: '42px', lineHeight: 1.5, marginBottom: '12px', wordBreak: 'break-word' }}>
          {r.emojis}
        </div>
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>🎬 What movie is this?</p>
      </div>

      {result !== null ? (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          borderRadius: '12px',
          background: result === 'correct' ? 'rgba(140,191,155,0.12)' : 'rgba(208,117,125,0.10)',
          border: `1px solid ${result === 'correct' ? 'var(--accent3)' : 'var(--accent2)'}`,
        }}>
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
            {result === 'correct' ? (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="rgba(140,191,155,0.3)"/><path d="M7 12l4 4 6-6" stroke="var(--accent3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            ) : (
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="rgba(208,117,125,0.2)"/><path d="M8 8l8 8M16 8l-8 8" stroke="var(--accent2)" strokeWidth="2.5" strokeLinecap="round"/></svg>
            )}
          </div>
          <div style={{ fontWeight: 800, fontSize: '16px', color: result === 'correct' ? 'var(--accent3)' : 'var(--accent2)' }}>
            {result === 'correct' ? 'Correct!' : `Wrong — it was "${r.answer}"`}
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
              placeholder="Type the movie name..."
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
