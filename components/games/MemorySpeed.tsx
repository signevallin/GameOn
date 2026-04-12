'use client';
import { useState, useEffect, useRef } from 'react';
import { MemorySpeedRound } from '@/lib/missions';

type Props = {
  rounds: MemorySpeedRound[];
  maxPts: number;
  onFinish: (correct: boolean, pts: number) => void;
};

export default function MemorySpeed({ rounds, maxPts, onFinish }: Props) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<'memorize' | 'recall'>('memorize');
  const [countdown, setCountdown] = useState(rounds[0].memorizeSeconds ?? 8);
  const [answered, setAnswered] = useState<string | null>(null);
  const [totalPts, setTotalPts] = useState(0);
  const recallStartRef = useRef(0);

  const round = rounds[idx];
  const memorizeSeconds = round.memorizeSeconds ?? 8;

  // Reset when round changes
  useEffect(() => {
    setPhase('memorize');
    setCountdown(memorizeSeconds);
    setAnswered(null);
  }, [idx, memorizeSeconds]);

  // Countdown tick
  useEffect(() => {
    if (phase !== 'memorize') return;
    if (countdown <= 0) {
      setPhase('recall');
      recallStartRef.current = Date.now();
      return;
    }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown, phase]);

  function pick(opt: string) {
    if (answered) return;
    setAnswered(opt);
    const isCorrect = opt === round.missing;
    const elapsed = (Date.now() - recallStartRef.current) / 1000;
    const ptsPerRound = Math.round(maxPts / rounds.length);
    const pts = isCorrect
      ? Math.round(ptsPerRound * 0.4 + ptsPerRound * 0.6 * Math.max(0, 1 - elapsed / 15))
      : 0;

    setTimeout(() => {
      const newTotal = totalPts + pts;
      if (idx + 1 >= rounds.length) {
        onFinish(newTotal > 0, newTotal);
      } else {
        setTotalPts(newTotal);
        setIdx(i => i + 1);
      }
    }, 1200);
  }

  const remainingItems = round.items.filter(item => item !== round.missing);
  const urgentCountdown = countdown <= 3;

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '2px' }}>
          ROUND {idx + 1} / {rounds.length}
        </span>
        <span style={{ fontSize: '12px', color: 'var(--accent)' }}>{totalPts} pts</span>
      </div>

      {phase === 'memorize' ? (
        <>
          {/* Countdown */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '8px' }}>
              MEMORIZE THESE ITEMS
            </p>
            <div style={{
              fontSize: '56px',
              fontWeight: 800,
              fontFamily: "'Sora', sans-serif",
              color: urgentCountdown ? 'var(--accent2)' : 'var(--accent3)',
              lineHeight: 1,
              animation: urgentCountdown ? 'pulse 0.5s infinite alternate' : 'none',
            }}>
              {countdown}
            </div>
          </div>

          {/* Items grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: round.items.length > 6 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
            gap: '10px',
          }}>
            {round.items.map((item, i) => (
              <div key={i} style={{
                padding: '14px 8px',
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                textAlign: 'center',
                fontSize: '13px',
                fontWeight: 600,
                lineHeight: 1.4,
              }}>
                {item}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Remaining items (with gap where missing was) */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '2px', marginBottom: '12px', textAlign: 'center' }}>
              🧠 ONE ITEM IS MISSING — WHICH ONE?
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: round.items.length > 6 ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
              gap: '8px',
              marginBottom: '24px',
            }}>
              {remainingItems.map((item, i) => (
                <div key={i} style={{
                  padding: '12px 8px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: 'var(--muted)',
                  lineHeight: 1.4,
                }}>
                  {item}
                </div>
              ))}
              {/* Empty slot placeholder */}
              <div style={{
                padding: '12px 8px',
                background: 'rgba(208,117,125,0.08)',
                border: '1px dashed var(--accent2)',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '18px',
                color: 'var(--accent2)',
              }}>
                ?
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="options-grid">
            {round.options.map(opt => {
              let cls = 'option-btn';
              if (answered) {
                if (opt === round.missing) cls += ' correct';
                else if (opt === answered) cls += ' wrong';
              }
              return (
                <button key={opt} className={cls} onClick={() => pick(opt)} disabled={!!answered}>
                  {opt}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
