'use client';
import { useEffect, useRef } from 'react';

export default function HackedOverlay({ hackedUntil }: { hackedUntil: Date }) {
  const secsLeft = Math.max(0, Math.ceil((hackedUntil.getTime() - Date.now()) / 1000));
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    let animId: number;
    function draw() {
      const w = canvas!.width, h = canvas!.height;
      const img = ctx.createImageData(w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.random() < 0.08) {
          const v = Math.floor(Math.random() * 80);
          d[i] = 0; d[i+1] = Math.floor(v * 0.74); d[i+2] = v; d[i+3] = 200;
        }
      }
      ctx.putImageData(img, 0, 0);
      if (Math.random() < 0.12) {
        const y = Math.floor(Math.random() * h);
        ctx.fillStyle = `rgba(124,189,212,${(Math.random() * 0.25).toFixed(2)})`;
        ctx.fillRect(0, y, w, Math.ceil(Math.random() * 3));
      }
      animId = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.18) 3px,rgba(0,0,0,0.18) 4px)' }} />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '32px 24px', userSelect: 'none' }}>
        <div className="hacked-glitch" style={{ fontFamily: 'monospace', fontSize: 'clamp(24px,7vw,52px)', fontWeight: 900, color: '#7CBDD4', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '18px', textShadow: '0 0 24px rgba(124,189,212,0.9), 3px 0 0 rgba(255,40,40,0.45), -3px 0 0 rgba(0,230,230,0.35)' }}>
          SYSTEM FAILURE
        </div>
        <div className="hacked-pulse" style={{ fontFamily: 'monospace', fontSize: 'clamp(11px,3.5vw,17px)', color: '#7CBDD4', letterSpacing: '3px', marginBottom: '48px', textTransform: 'uppercase' }}>
          You have been hacked
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: 'rgba(124,189,212,0.4)', letterSpacing: '2px' }}>
          SYSTEM RESTORE IN {secsLeft}s
        </div>
      </div>
    </div>
  );
}
