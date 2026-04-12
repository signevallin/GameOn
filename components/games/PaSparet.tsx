'use client';
import { useRef, useState } from 'react';

type Props = {
  clues: string[];
  answer: string;
  maxPts: number;
  placeholder?: string;
  onFinish: (correct: boolean, pts: number) => void;
};

const PTS_BY_CLUE = [500, 400, 300, 200, 100];

export default function PaSparet({ clues, answer, maxPts, placeholder = 'Who is this person?', onFinish }: Props) {
  const [revealed, setRevealed] = useState(1);
  const [guess, setGuess] = useState('');
  const [wrong, setWrong] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pts = PTS_BY_CLUE[revealed - 1] ?? 100;
  const allRevealed = revealed >= clues.length;

  function submit() {
    if (!guess.trim()) return;
    const correct = guess.trim().toLowerCase() === answer.toLowerCase();

    if (correct) {
      setDone(true);
      onFinish(true, pts);
      return;
    }

    // Wrong guess
    setWrong(w => [...w, revealed]);
    setGuess('');

    if (allRevealed) {
      // No more clues and wrong
      setTimeout(() => onFinish(false, 0), 600);
    } else {
      setRevealed(r => r + 1);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', color: 'var(--muted)', letterSpacing: '2px' }}>
          CLUE {revealed} / {clues.length}
        </div>
        <div style={{ fontWeight: 700, color: 'var(--gold)', fontFamily: "'Sora', sans-serif" }}>
          {pts} pts available
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
        {clues.slice(0, revealed).map((clue, i) => (
          <div key={i} style={{
            padding: '16px 20px',
            background: i === revealed - 1 ? 'rgba(117,171,200,0.08)' : 'var(--surface)',
            border: `1px solid ${i === revealed - 1 ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: '10px',
            fontSize: '15px',
            lineHeight: '1.5',
            transition: 'all 0.3s',
          }}>
            <span style={{ color: 'var(--accent)', fontWeight: 700, marginRight: '10px', fontSize: '12px', letterSpacing: '1px' }}>
              CLUE {i + 1}
            </span>
            <br />
            {clue}
          </div>
        ))}
      </div>

      {wrong.length > 0 && (
        <p style={{ fontSize: '13px', color: 'var(--accent2)', marginBottom: '12px' }}>
          ❌ {wrong.length} wrong {wrong.length === 1 ? 'guess' : 'guesses'} – next clue revealed!
        </p>
      )}

      {!done && (
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            ref={inputRef}
            type="text"
            value={guess}
            onChange={e => setGuess(e.target.value)}
            placeholder={placeholder}
            onKeyDown={e => e.key === 'Enter' && submit()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={submit} style={{ flexShrink: 0 }}>
            GUESS →
          </button>
        </div>
      )}

      {!allRevealed && !done && (
        <button
          className="btn btn-ghost btn-full"
          onClick={() => { setRevealed(r => r + 1); setGuess(''); }}
          style={{ marginTop: '12px', fontSize: '12px' }}
        >
          SHOW NEXT CLUE (-{PTS_BY_CLUE[revealed - 1] - (PTS_BY_CLUE[revealed] ?? 50)} pts)
        </button>
      )}
    </>
  );
}
