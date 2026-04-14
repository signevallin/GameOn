'use client';
import { useState, useEffect } from 'react';

type Props = {
  onFinish: (correct: boolean, pts: number) => void;
  maxPts?: number;
};

const MEMORIZE_SECS = 5;

function hsl(h: number, s: number, l: number) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export default function ColorMemory({ onFinish, maxPts = 400 }: Props) {
  const [phase, setPhase] = useState<'memorize' | 'match'>('memorize');
  const [countdown, setCountdown] = useState(MEMORIZE_SECS);

  const [target] = useState(() => ({
    h: Math.floor(Math.random() * 360),
    s: 40 + Math.floor(Math.random() * 45), // 40–85 — avoid washed-out greys
    l: 32 + Math.floor(Math.random() * 30), // 32–62 — avoid too dark / too bright
  }));

  const [guess, setGuess] = useState({ h: 180, s: 50, l: 50 });

  // Countdown
  useEffect(() => {
    if (phase !== 'memorize') return;
    if (countdown <= 0) { setPhase('match'); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  function submit() {
    const dH = Math.min(Math.abs(target.h - guess.h), 360 - Math.abs(target.h - guess.h)) / 180;
    const dS = Math.abs(target.s - guess.s) / 100;
    const dL = Math.abs(target.l - guess.l) / 100;
    const distance = dH * 0.5 + dS * 0.25 + dL * 0.25;
    const pts = Math.max(0, Math.round(maxPts * (1 - distance / 0.45)));
    onFinish(pts >= Math.round(maxPts * 0.25), pts);
  }

  const targetColor  = hsl(target.h, target.s, target.l);
  const guessColor   = hsl(guess.h, guess.s, guess.l);
  const progress     = countdown / MEMORIZE_SECS;
  const circumference = 2 * Math.PI * 36;

  // ── Memorize phase ─────────────────────────────────────────────────────────
  if (phase === 'memorize') {
    return (
      <div style={{ padding: '28px 20px 48px', textAlign: 'center', maxWidth: '420px', margin: '0 auto' }}>
        <p style={{ fontSize: '11px', letterSpacing: '2.5px', fontWeight: 700, color: 'var(--muted)', marginBottom: '24px' }}>
          MEMORIZE THIS COLOR
        </p>

        {/* Color swatch */}
        <div style={{
          width: '100%',
          maxWidth: '280px',
          aspectRatio: '1 / 1',
          background: targetColor,
          borderRadius: '20px',
          margin: '0 auto 36px',
          boxShadow: `0 0 60px ${targetColor}80, 0 0 120px ${targetColor}30`,
          transition: 'background 0.3s',
        }} />

        {/* Circular countdown */}
        <div style={{ position: 'relative', width: '88px', height: '88px', margin: '0 auto' }}>
          <svg width="88" height="88" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
            <circle cx="44" cy="44" r="36" fill="none" stroke="var(--border)" strokeWidth="5" />
            <circle
              cx="44" cy="44" r="36"
              fill="none"
              stroke={targetColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '30px', fontWeight: 800,
          }}>
            {countdown}
          </div>
        </div>
      </div>
    );
  }

  // ── Match phase ────────────────────────────────────────────────────────────
  const sliders = [
    {
      key: 'h' as const,
      label: 'Färg',
      min: 0, max: 360,
      value: guess.h,
      gradient: [0,30,60,90,120,150,180,210,240,270,300,330,360]
        .map(h => `hsl(${h},75%,55%)`).join(', '),
    },
    {
      key: 's' as const,
      label: 'Kontrast',
      min: 0, max: 100,
      value: guess.s,
      gradient: `hsl(${guess.h},0%,${guess.l}%), hsl(${guess.h},100%,${guess.l}%)`,
    },
    {
      key: 'l' as const,
      label: 'Mörk → Ljust',
      min: 0, max: 100,
      value: guess.l,
      gradient: `hsl(${guess.h},${guess.s}%,5%), hsl(${guess.h},${guess.s}%,50%), hsl(${guess.h},${guess.s}%,98%)`,
    },
  ];

  return (
    <div style={{ padding: '24px 20px 48px', maxWidth: '460px', margin: '0 auto' }}>
      <p style={{ fontSize: '11px', letterSpacing: '2.5px', fontWeight: 700, color: 'var(--muted)', marginBottom: '20px', textAlign: 'center' }}>
        MATCH THE COLOR
      </p>

      {/* Side-by-side preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '28px' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '1.5px', fontWeight: 700, textAlign: 'center', marginBottom: '6px' }}>YOUR MIX</div>
          <div style={{
            height: '90px', borderRadius: '14px',
            background: guessColor,
            border: '2px solid var(--border)',
            transition: 'background 0.15s',
          }} />
        </div>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', letterSpacing: '1.5px', fontWeight: 700, textAlign: 'center', marginBottom: '6px' }}>TARGET</div>
          <div style={{
            height: '90px', borderRadius: '14px',
            background: 'var(--surface)',
            border: '2px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '28px', opacity: 0.4 }}>?</span>
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', marginBottom: '28px' }}>
        {sliders.map(({ key, label, min, max, value, gradient }) => (
          <div key={key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{label}</span>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
            </div>

            {/* Track + thumb wrapper */}
            <div style={{ position: 'relative', height: '32px', display: 'flex', alignItems: 'center' }}>
              {/* Gradient track */}
              <div style={{
                position: 'absolute', left: 0, right: 0,
                height: '12px', borderRadius: '6px',
                background: `linear-gradient(to right, ${gradient})`,
                pointerEvents: 'none',
              }} />
              <input
                type="range"
                className="color-slider"
                min={min} max={max} value={value}
                onChange={e => setGuess(g => ({ ...g, [key]: Number(e.target.value) }))}
              />
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" style={{ width: '100%', fontSize: '15px' }} onClick={submit}>
        Submit
      </button>
    </div>
  );
}
