'use client';
import { useEffect, useRef, useState } from 'react';

type Round = { emoji: string; label: string; accept: string[] };

const ROUNDS: Round[] = [
  { emoji: '🗼', label: 'Eiffeltornet',        accept: ['eiffeltornet','eiffel tower','eiffel','eiffeltorn'] },
  { emoji: '🦁', label: 'Lejon',               accept: ['lejon','lion'] },
  { emoji: '🎸', label: 'Gitarr',              accept: ['gitarr','guitar','elgitarr'] },
  { emoji: '🌋', label: 'Vulkan',              accept: ['vulkan','volcano'] },
  { emoji: '🦅', label: 'Örn',                 accept: ['örn','eagle','örnfågel'] },
  { emoji: '🎺', label: 'Trumpet',             accept: ['trumpet','trumpethorn'] },
  { emoji: '🏯', label: 'Japanskt slott',      accept: ['japanskt slott','slott','castle','pagoda','tempel'] },
  { emoji: '🦑', label: 'Bläckfisk',           accept: ['bläckfisk','squid','octopus'] },
];

const MAX_BLUR = 20;
const BLUR_STEP = 2;
const BLUR_INTERVAL = 1500; // ms

type Props = {
  maxPts: number;
  onFinish: (correct: boolean, pts?: number) => void;
};

export default function PixelReveal({ maxPts, onFinish }: Props) {
  const [rounds]            = useState<Round[]>(() => [...ROUNDS].sort(() => Math.random() - 0.5).slice(0, 3));
  const [roundIdx, setRoundIdx] = useState(0);
  const [blur, setBlur]         = useState(MAX_BLUR);
  const [guess, setGuess]       = useState('');
  const [wrong, setWrong]       = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [totalPts, setTotalPts] = useState(0);

  const blurRef    = useRef(MAX_BLUR);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const revealedRef = useRef(false);

  const ptsPerRound = Math.round(maxPts / rounds.length);

  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (blurRef.current <= 0) { clearInterval(timerRef.current!); return; }
      blurRef.current = Math.max(0, blurRef.current - BLUR_STEP);
      setBlur(blurRef.current);
    }, BLUR_INTERVAL);
  }

  useEffect(() => {
    blurRef.current = MAX_BLUR;
    revealedRef.current = false;
    setBlur(MAX_BLUR);
    setGuess('');
    setWrong(false);
    setRevealed(false);
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundIdx]);

  function submit() {
    if (revealedRef.current) return;
    const g = guess.trim().toLowerCase();
    const r = rounds[roundIdx];
    if (r.accept.some(a => a.toLowerCase() === g)) {
      if (timerRef.current) clearInterval(timerRef.current);
      // More points the higher the blur (earlier the guess)
      const pts = Math.max(
        Math.round(ptsPerRound * 0.15),
        Math.round(ptsPerRound * (blurRef.current / MAX_BLUR)),
      );
      const newTotal = totalPts + pts;
      revealedRef.current = true;
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
  const blurLevel = Math.round(blur / MAX_BLUR * 10); // 0-10 bar

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <span style={{ fontSize: '13px', color: 'var(--muted)', letterSpacing: '2px' }}>
          BILD {roundIdx + 1}/{rounds.length}
        </span>
        <span style={{ fontWeight: 800, color: 'var(--gold)' }}>{totalPts} pts</span>
      </div>

      {/* Blurred emoji in clipped container */}
      <div style={{
        width: 220, height: 220,
        margin: '0 auto 20px',
        overflow: 'hidden',
        borderRadius: 16,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{
          fontSize: 160,
          lineHeight: 1,
          display: 'block',
          filter: revealed ? 'none' : `blur(${blur}px)`,
          transition: 'filter 0.6s ease',
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

      {/* Blur indicator */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <span style={{ fontSize: '11px', color: 'var(--muted)', letterSpacing: '1px' }}>SUDDIGHET</span>
        <div style={{ display: 'flex', gap: '3px' }}>
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} style={{
              width: 6, height: 14, borderRadius: 3,
              background: i < blurLevel ? 'var(--accent2)' : 'var(--border)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
        <span style={{ fontSize: '11px', color: blur === 0 ? 'var(--accent3)' : 'var(--muted)', letterSpacing: '1px' }}>KLART</span>
      </div>

      {wrong && (
        <p style={{ color: 'var(--accent2)', fontSize: '13px', marginBottom: '12px' }}>❌ Fel! Fortsätt försöka…</p>
      )}

      {!revealed && (
        <div style={{ display: 'flex', gap: '10px', maxWidth: '420px', margin: '0 auto' }}>
          <input
            type="text"
            value={guess}
            onChange={e => setGuess(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Vad föreställer bilden?"
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={submit} style={{ flexShrink: 0 }}>
            GISSA →
          </button>
        </div>
      )}
    </div>
  );
}
