'use client';
import { useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'waiting' | 'ready' | 'done';

type Props = { maxPts: number; missionId: string; onFinish: (correct: boolean, pts: number) => void };

export default function ReactionTest({ maxPts, onFinish }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [reactionMs, setReactionMs] = useState(0);
  const startRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  function start() {
    setPhase('waiting');
    const delay = 1500 + Math.random() * 3000;
    timeoutRef.current = setTimeout(() => {
      startRef.current = Date.now();
      setPhase('ready');
    }, delay);
  }

  function click() {
    if (phase === 'idle') { start(); return; }
    if (phase === 'waiting') { /* too early – ignore */ return; }
    if (phase === 'ready') {
      const ms = Date.now() - startRef.current;
      setReactionMs(ms);
      setPhase('done');
    }
  }

  if (phase === 'done') {
    const pts = reactionMs < 200 ? maxPts : reactionMs < 400 ? Math.round(maxPts * 0.7) : Math.round(maxPts * 0.4);
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎯</div>
        <div style={{ fontSize: '48px', color: 'var(--accent)', fontWeight: 700 }}>{reactionMs}ms</div>
        <p style={{ color: 'var(--muted)', margin: '12px 0 24px', fontSize: '14px' }}>
          {reactionMs < 200 ? '⚡ Lightning fast!' : reactionMs < 400 ? '👍 Good reaction!' : '🐢 A bit slow...'}
        </p>
        <button className="btn btn-primary" onClick={() => onFinish(true, pts)}>
          CLAIM {pts} POINTS →
        </button>
      </div>
    );
  }

  const isReady = phase === 'ready';

  return (
    <>
      <div className="challenge-question">Wait for the red flash – then click as fast as you can!</div>
      <div
        onClick={click}
        style={{
          background: isReady ? 'rgba(208,117,125,0.15)' : 'var(--surface)',
          border: `2px solid ${isReady ? 'var(--accent2)' : 'var(--border)'}`,
          borderRadius: '16px',
          padding: '60px 40px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          userSelect: 'none',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>{isReady ? '⚡' : '👀'}</div>
        <p style={{
          fontFamily: "'Sora', sans-serif",
          fontSize: isReady ? '18px' : '14px',
          color: isReady ? 'var(--accent2)' : 'var(--muted)',
          fontWeight: isReady ? 700 : 400,
        }}>
          {phase === 'idle' ? 'CLICK HERE TO START' : phase === 'waiting' ? 'Wait for it...' : 'CLICK NOW!'}
        </p>
      </div>
    </>
  );
}
