'use client';
import { useEffect, useRef, useState } from 'react';

const COLORS = [
  { id: 'red',    bg: '#c0392b', active: '#ff6b6b' },
  { id: 'blue',   bg: '#2980b9', active: '#74b9ff' },
  { id: 'green',  bg: '#27ae60', active: '#55efc4' },
  { id: 'yellow', bg: '#f39c12', active: '#ffeaa7' },
];

const WIN_LEVEL = 5;

type Phase = 'intro' | 'show' | 'input' | 'wrong' | 'win';

type Props = {
  maxPts: number;
  onFinish: (correct: boolean, pts?: number) => void;
};

export default function SimonSays({ maxPts, onFinish }: Props) {
  const [sequence, setSequence]   = useState<number[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [phase, setPhase]         = useState<Phase>('intro');
  const [playerIdx, setPlayerIdx] = useState(0);
  const [level, setLevel]         = useState(0);
  const phaseRef = useRef<Phase>('intro');
  phaseRef.current = phase;

  function startGame() {
    const first = Math.floor(Math.random() * 4);
    setSequence([first]);
    setLevel(1);
    setPhase('show');
    showSequence([first]);
  }

  function showSequence(seq: number[]) {
    let i = 0;
    function next() {
      if (i >= seq.length) {
        setTimeout(() => { setActiveIdx(null); setPlayerIdx(0); setPhase('input'); }, 400);
        return;
      }
      setActiveIdx(null);
      setTimeout(() => {
        setActiveIdx(seq[i]);
        i++;
        setTimeout(next, 700);
      }, 300);
    }
    setTimeout(next, 800);
  }

  function handlePress(colorIdx: number) {
    if (phaseRef.current !== 'input') return;

    if (colorIdx !== sequence[playerIdx]) {
      setPhase('wrong');
      setActiveIdx(colorIdx);
      const earnedPts = Math.round(maxPts * Math.max(0, level - 1) / WIN_LEVEL);
      setTimeout(() => onFinish(false, earnedPts > 0 ? earnedPts : undefined), 1400);
      return;
    }

    setActiveIdx(colorIdx);
    setTimeout(() => setActiveIdx(null), 280);

    const next = playerIdx + 1;
    if (next >= sequence.length) {
      const nextLevel = level + 1;
      if (nextLevel > WIN_LEVEL) {
        setPhase('win');
        setTimeout(() => onFinish(true, maxPts), 900);
        return;
      }
      setLevel(nextLevel);
      setPhase('show');
      const newSeq = [...sequence, Math.floor(Math.random() * 4)];
      setSequence(newSeq);
      setTimeout(() => showSequence(newSeq), 1000);
    } else {
      setPlayerIdx(next);
    }
  }

  const statusLabel =
    phase === 'intro' ? '' :
    phase === 'show'  ? '👁️ WATCH THE SEQUENCE…' :
    phase === 'input' ? '👆 YOUR TURN – REPEAT!' :
    phase === 'wrong' ? '❌ WRONG! GAME OVER' :
                        '🏆 ALL LEVELS COMPLETE!';

  return (
    <div style={{ textAlign: 'center' }}>
      {phase === 'intro' ? (
        <>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>
            Watch the color sequence and repeat it exactly.<br />
            Complete <strong style={{ color: 'var(--gold)' }}>{WIN_LEVEL} levels</strong> for full points!
          </p>
          <button className="btn btn-primary" onClick={startGame}>START SIMON →</button>
        </>
      ) : (
        <>
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px' }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)', letterSpacing: '1px' }}>{statusLabel}</span>
            <span style={{ fontWeight: 800, color: 'var(--gold)', fontSize: '13px' }}>
              LEVEL {level}/{WIN_LEVEL}
            </span>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px',
            maxWidth: '280px', margin: '0 auto 24px',
          }}>
            {COLORS.map((c, i) => (
              <button
                key={c.id}
                onClick={() => handlePress(i)}
                style={{
                  height: '110px', borderRadius: '18px',
                  border: 'none', cursor: phase === 'input' ? 'pointer' : 'default',
                  background: activeIdx === i ? c.active : c.bg,
                  transition: 'background 0.12s, transform 0.12s, box-shadow 0.12s',
                  transform: activeIdx === i ? 'scale(0.91)' : 'scale(1)',
                  boxShadow: activeIdx === i ? `0 0 28px ${c.active}99` : `0 4px 12px rgba(0,0,0,0.35)`,
                }}
              />
            ))}
          </div>

          {phase === 'wrong' && (
            <p style={{ color: 'var(--accent2)', fontSize: '14px' }}>
              You completed {level - 1} of {WIN_LEVEL} levels.
            </p>
          )}
        </>
      )}
    </div>
  );
}
