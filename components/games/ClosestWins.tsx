'use client';
import { useState } from 'react';
import { useRemoteRoundSync } from '@/hooks/useRemoteRoundSync';

type Question = { q: string; answer: number; unit: string; hint: string };

const DEFAULT_QUESTIONS: Question[] = [
  { q: 'How tall is the Eiffel Tower in metres?',        answer: 330,    unit: 'm',       hint: 'Including the antenna' },
  { q: 'How long is the Nile river in kilometres?',      answer: 6650,   unit: 'km',      hint: "The world's longest river" },
  { q: 'How many countries are there in the world?',     answer: 195,    unit: 'countries',hint: 'UN-recognised states' },
  { q: 'In what year was the Great Wall of China begun?',answer: 221,    unit: 'BC',      hint: 'Under the Qin dynasty' },
  { q: 'How many legs does an octopus have?',            answer: 8,      unit: 'legs',    hint: 'Think about the name' },
  { q: 'What is the speed of light in km/s (rounded)?',  answer: 300000, unit: 'km/s',   hint: 'The fastest thing in existence' },
];

type Props = {
  maxPts: number;
  questions?: Question[];
  teamId?: string;
  missionId?: string;
  onFinish: (correct: boolean, pts?: number) => void;
};

export default function ClosestWins({ maxPts, questions: propQuestions, teamId, missionId, onFinish }: Props) {
  const [questions]  = useState(() => {
    const pool = propQuestions ?? DEFAULT_QUESTIONS;
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  });
  const [qIdx, setQIdx]           = useState(0);
  const [guess, setGuess]         = useState('');
  const [result, setResult]       = useState<{ pts: number; accuracy: number } | null>(null);
  const [totalPts, setTotalPts]   = useState(0);
  const [done, setDone]           = useState(false);

  const { broadcastRound, clearRound } = useRemoteRoundSync({
    teamId,
    missionId,
    onRemoteAdvance: (idx) => {
      setQIdx(idx);
      setGuess('');
      setResult(null);
    },
  });

  const ptsPerQ = Math.round(maxPts / questions.length);
  const q = questions[qIdx];

  function submit() {
    const val = parseFloat(guess.replace(',', '.'));
    if (isNaN(val)) return;

    const error = Math.abs(val - q.answer) / Math.max(1, q.answer);
    // Full pts at exact, 0 pts at 50%+ error
    const pts = Math.round(ptsPerQ * Math.max(0, 1 - error / 0.5));
    const accuracy = Math.max(0, Math.round((1 - error) * 100));
    setResult({ pts, accuracy });
    setTotalPts(prev => prev + pts);
  }

  function next() {
    const newTotal = totalPts + (result?.pts ?? 0);
    if (qIdx + 1 >= questions.length) {
      clearRound();
      setDone(true);
      onFinish(newTotal > 0, newTotal);
    } else {
      const nextIdx = qIdx + 1;
      setQIdx(nextIdx);
      setGuess('');
      setResult(null);
      broadcastRound(nextIdx);
    }
  }

  if (done) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)', letterSpacing: '2px' }}>
          QUESTION {qIdx + 1}/{questions.length}
        </span>
        <span style={{ fontWeight: 800, color: 'var(--gold)' }}>{totalPts} pts</span>
      </div>

      <h3 style={{ fontSize: '17px', lineHeight: 1.5, marginBottom: '10px' }}>{q.q}</h3>
      <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>
        💡 {q.hint}
      </p>

      {!result ? (
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="number"
            inputMode="numeric"
            value={guess}
            onChange={e => setGuess(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder={`Your answer${q.unit ? ` (${q.unit})` : ''}`}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={submit} style={{ flexShrink: 0 }}>
            ANSWER →
          </button>
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '24px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '6px' }}>
            Correct answer: <strong style={{ color: 'var(--text)' }}>{q.answer.toLocaleString()} {q.unit}</strong>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
            Your answer: <strong style={{ color: 'var(--text)' }}>{parseFloat(guess).toLocaleString()} {q.unit}</strong>
          </div>

          <div style={{
            fontSize: '36px', fontWeight: 800, marginBottom: '4px',
            color: result.pts > ptsPerQ * 0.5 ? 'var(--gold)' : result.pts > 0 ? 'var(--accent)' : 'var(--accent2)',
          }}>
            +{result.pts} pts
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
            Accuracy: {result.accuracy}%
          </div>

          <button className="btn btn-primary" onClick={next}>
            {qIdx + 1 >= questions.length ? 'SEE RESULTS →' : 'NEXT QUESTION →'}
          </button>
        </div>
      )}
    </div>
  );
}
