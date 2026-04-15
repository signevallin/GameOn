'use client';
import { useEffect, useState } from 'react';

type Round = { emoji: string; label: string; accept: string[] };

const ROUNDS: Round[] = [
  { emoji: '🍕', label: 'Pizza',    accept: ['pizza'] },
  { emoji: '🚂', label: 'Train',    accept: ['train','steam train','locomotive'] },
  { emoji: '🎯', label: 'Dartboard',accept: ['dartboard','dart','darts'] },
  { emoji: '🦋', label: 'Butterfly',accept: ['butterfly'] },
  { emoji: '🏆', label: 'Trophy',   accept: ['trophy','cup'] },
  { emoji: '🌍', label: 'Globe',    accept: ['globe','earth','world'] },
  { emoji: '🎪', label: 'Circus',   accept: ['circus','circus tent','tent'] },
  { emoji: '🦒', label: 'Giraffe',  accept: ['giraffe'] },
];

// Scale steps: zoomed in → zoomed out. Higher = more zoomed in.
const SCALES = [6, 4, 3, 2, 1.2];
const CONTAINER = 200; // px

type Props = {
  maxPts: number;
  onFinish: (correct: boolean, pts?: number) => void;
};

export default function ZoomIn({ maxPts, onFinish }: Props) {
  const [rounds]               = useState<Round[]>(() => [...ROUNDS].sort(() => Math.random() - 0.5).slice(0, 3));
  const [roundIdx, setRoundIdx] = useState(0);
  const [scaleStep, setScaleStep] = useState(0);
  const [guess, setGuess]       = useState('');
  const [wrong, setWrong]       = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [totalPts, setTotalPts] = useState(0);

  const ptsPerRound = Math.round(maxPts / rounds.length);

  useEffect(() => {
    setScaleStep(0);
    setGuess('');
    setWrong(false);
    setRevealed(false);
  }, [roundIdx]);

  function revealMore() {
    if (scaleStep < SCALES.length - 1) setScaleStep(s => s + 1);
  }

  function submit() {
    if (revealed) return;
    const g = guess.trim().toLowerCase();
    const r = rounds[roundIdx];
    if (r.accept.some(a => a.toLowerCase() === g)) {
      // Points decrease with each zoom step used
      const stepPct = 1 - (scaleStep / (SCALES.length - 1)) * 0.8;
      const pts = Math.max(Math.round(ptsPerRound * 0.2), Math.round(ptsPerRound * stepPct));
      const newTotal = totalPts + pts;
      setRevealed(true);
      setTotalPts(newTotal);
      setTimeout(() => {
        if (roundIdx + 1 >= rounds.length) {
          onFinish(true, newTotal);
        } else {
          setRoundIdx(i => i + 1);
        }
      }, 1800);
    } else {
      setWrong(true);
      setGuess('');
    }
  }

  const r = rounds[roundIdx];
  const scale = SCALES[scaleStep];
  const stepsLeft = SCALES.length - 1 - scaleStep;

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)', letterSpacing: '2px' }}>
          IMAGE {roundIdx + 1}/{rounds.length}
        </span>
        <span style={{ fontWeight: 800, color: 'var(--gold)' }}>{totalPts} pts</span>
      </div>

      {/* Zoomed emoji */}
      <div style={{
        width: CONTAINER, height: CONTAINER,
        margin: '0 auto 20px',
        overflow: 'hidden',
        borderRadius: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{
          fontSize: Math.round(CONTAINER * 0.85),
          lineHeight: 1,
          display: 'block',
          transform: `scale(${scale})`,
          transition: 'transform 0.7s cubic-bezier(0.25,0.46,0.45,0.94)',
          userSelect: 'none',
        }}>
          {r.emoji}
        </span>
        {revealed && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            background: 'rgba(0,0,0,0.65)', padding: '8px',
            fontSize: '13px', fontWeight: 800, color: 'var(--accent3)',
          }}>
            ✓ {r.label}
          </div>
        )}
      </div>

      {/* Zoom level indicator */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        {SCALES.map((_, i) => (
          <div key={i} style={{
            width: 28, height: 6, borderRadius: 3,
            background: i <= scaleStep ? 'var(--accent)' : 'var(--border)',
            transition: 'background 0.3s',
          }} />
        ))}
        <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '4px' }}>
          {scale}x
        </span>
      </div>

      {wrong && (
        <p style={{ color: 'var(--accent2)', fontSize: '13px', marginBottom: '12px' }}>❌ Wrong! Try again…</p>
      )}

      {!revealed && (
        <>
          <div style={{ display: 'flex', gap: '10px', maxWidth: '420px', margin: '0 auto 12px' }}>
            <input
              type="text"
              value={guess}
              onChange={e => setGuess(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="What does the image show?"
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={submit} style={{ flexShrink: 0 }}>
              GUESS →
            </button>
          </div>

          {stepsLeft > 0 && (
            <button
              className="btn btn-ghost btn-full"
              onClick={revealMore}
              style={{ fontSize: '12px' }}
            >
              🔎 ZOOM OUT ({stepsLeft} steps left)
            </button>
          )}
        </>
      )}
    </div>
  );
}
