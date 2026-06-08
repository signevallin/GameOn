'use client';
import { useEffect, useRef, useState } from 'react';

// Minimal WebXR type declarations (not in standard TS lib)
declare global {
  interface Navigator {
    xr?: {
      isSessionSupported(mode: string): Promise<boolean>;
      requestSession(mode: string, options?: XRSessionInit): Promise<XRSession>;
    };
  }
  interface XRSessionInit {
    requiredFeatures?: string[];
    optionalFeatures?: string[];
    domOverlay?: { root: Element };
  }
  interface XRSession extends EventTarget {
    requestAnimationFrame(callback: (time: number, frame: XRFrame) => void): number;
    requestReferenceSpace(type: string): Promise<XRReferenceSpace>;
    updateRenderState(state: { baseLayer?: XRWebGLLayer }): void;
    end(): Promise<void>;
  }
  interface XRFrame {
    getHitTestResults(source: XRHitTestSource): XRHitTestResult[];
  }
  interface XRReferenceSpace {}
  interface XRHitTestSource {
    cancel(): void;
  }
  interface XRHitTestResult {}
  class XRWebGLLayer {
    constructor(session: XRSession, gl: WebGLRenderingContext);
  }
}

type Props = {
  mode: 'place' | 'claim';
  onPlace?: () => void;
  onClaim?: (result: 'won' | 'taken' | 'expired') => void;
  teamId?: string;
  onClose: () => void;
};

const POWERUP_ICONS: Record<string, string> = {
  shield: '🛡️',
  freeze: '❄️',
  double_trouble: '😈',
  all_in: '🎲',
  point_steal: '🎰',
  robin_hood: '🏹',
};

export default function MysteryBoxAR({ mode, onPlace, onClaim, teamId, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<XRSession | null>(null);

  const [arSupported, setArSupported] = useState<boolean | null>(null);
  const [arActive, setArActive] = useState(false);
  const [hasHit, setHasHit] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<{ type: 'won' | 'taken' | 'expired'; powerup?: string } | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.xr) {
      setArSupported(false);
      return;
    }
    navigator.xr.isSessionSupported('immersive-ar')
      .then(setArSupported)
      .catch(() => setArSupported(false));
  }, []);

  useEffect(() => {
    return () => {
      sessionRef.current?.end().catch(() => {});
    };
  }, []);

  async function startAR() {
    if (!navigator.xr || !overlayRef.current) return;
    try {
      const session = await navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        domOverlay: { root: overlayRef.current },
      } as XRSessionInit);
      sessionRef.current = session;

      // Minimal WebGL context required by the AR session
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl', { xrCompatible: true }) as
        WebGLRenderingContext & { makeXRCompatible: () => Promise<void> };
      await gl.makeXRCompatible();
      session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });

      const refSpace = await session.requestReferenceSpace('local');
      const viewerSpace = await session.requestReferenceSpace('viewer');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let hitSource: XRHitTestSource | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        hitSource = await (session as any).requestHitTestSource({ space: viewerSpace });
      } catch {
        /* hit-test optional — box stays centered */
      }

      session.addEventListener('end', () => {
        hitSource?.cancel();
        sessionRef.current = null;
        setArActive(false);
        setHasHit(false);
      });

      setArActive(true);

      function frame(_time: number, xrFrame: XRFrame) {
        if (!sessionRef.current) return;
        session.requestAnimationFrame(frame);
        if (hitSource) {
          const hits = xrFrame.getHitTestResults(hitSource);
          setHasHit(hits.length > 0);
        } else {
          setHasHit(true);
        }
        void refSpace; // consumed to avoid unused-var lint warning
      }
      session.requestAnimationFrame(frame);
    } catch {
      setArSupported(false);
    }
  }

  async function handleAction() {
    if (claiming) return;
    if (mode === 'place') {
      await sessionRef.current?.end().catch(() => {});
      onPlace?.();
      return;
    }
    setClaiming(true);
    await sessionRef.current?.end().catch(() => {});
    try {
      const res = await fetch('/api/team/mystery-box/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ type: 'won', powerup: data.powerup });
        setTimeout(() => onClaim?.('won'), 2500);
      } else if (res.status === 409 && data.code === 'already_claimed') {
        setResult({ type: 'taken' });
        setTimeout(() => onClaim?.('taken'), 2000);
      } else {
        setResult({ type: 'expired' });
        setTimeout(() => onClaim?.('expired'), 2000);
      }
    } catch {
      setResult({ type: 'expired' });
      setTimeout(() => onClaim?.('expired'), 2000);
    } finally {
      setClaiming(false);
    }
  }

  const overlayStyles: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 2000,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    gap: '24px',
  };

  // Result screen
  if (result) {
    return (
      <div style={{ ...overlayStyles, background: 'rgba(0,0,0,0.92)' }}>
        <style>{`
          @keyframes popIn { from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
          @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
        {result.type === 'won' && (
          <>
            <div style={{ fontSize: '80px', animation: 'popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>🎁</div>
            <div style={{ fontWeight: 800, fontSize: '24px', color: 'var(--gold)', letterSpacing: '2px' }}>YOU GOT IT!</div>
            <div style={{ fontSize: '56px' }}>{POWERUP_ICONS[result.powerup ?? ''] ?? '⚡'}</div>
            <div style={{ fontSize: '15px', color: 'var(--muted)', textAlign: 'center' }}>
              +1 <strong style={{ color: 'var(--text)' }}>{result.powerup?.replace(/_/g, ' ').toUpperCase()}</strong> charge
            </div>
          </>
        )}
        {result.type === 'taken' && (
          <>
            <div style={{ fontSize: '72px' }}>💨</div>
            <div style={{ fontWeight: 800, fontSize: '22px', color: 'var(--accent2)' }}>TOO SLOW!</div>
            <div style={{ fontSize: '14px', color: 'var(--muted)' }}>Another team grabbed it first</div>
          </>
        )}
        {result.type === 'expired' && (
          <>
            <div style={{ fontSize: '72px' }}>⏰</div>
            <div style={{ fontWeight: 800, fontSize: '22px', color: 'var(--muted)' }}>DISAPPEARED</div>
            <div style={{ fontSize: '14px', color: 'var(--muted)' }}>The box vanished…</div>
          </>
        )}
      </div>
    );
  }

  // Close button (shared)
  const closeBtn = (
    <button
      onClick={() => { sessionRef.current?.end().catch(() => {}); onClose(); }}
      style={{
        position: 'absolute', top: '24px', right: '24px',
        background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: '50%', width: '40px', height: '40px',
        color: '#fff', fontSize: '18px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Sora', sans-serif",
      }}
    >✕</button>
  );

  // 2D fallback
  if (arSupported === false) {
    return (
      <div style={{ ...overlayStyles, background: 'rgba(0,0,0,0.92)' }}>
        <style>{`@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>
        {closeBtn}
        <div style={{ fontSize: '96px', animation: 'float 2s ease-in-out infinite' }}>📦</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', maxWidth: '260px' }}>
          AR not supported on this device
        </div>
        {mode === 'place' && (
          <button className="btn btn-primary" onClick={() => onPlace?.()} style={{ fontSize: '16px', padding: '14px 32px' }}>
            📦 Place Box Here
          </button>
        )}
        {mode === 'claim' && (
          <button
            className="btn btn-primary"
            onClick={handleAction}
            disabled={claiming}
            style={{ fontSize: '16px', padding: '14px 32px', background: 'var(--gold)', borderColor: 'var(--gold)', color: '#000' }}
          >
            {claiming ? '...' : '📦 TAP TO OPEN!'}
          </button>
        )}
      </div>
    );
  }

  // Pre-AR launch screen
  if (!arActive) {
    return (
      <div style={{ ...overlayStyles, background: 'rgba(0,0,0,0.92)' }}>
        <style>{`@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }`}</style>
        {closeBtn}
        <div style={{ fontSize: '80px', animation: 'float 2s ease-in-out infinite' }}>📦</div>
        {arSupported === null ? (
          <div style={{ color: 'var(--muted)', fontSize: '14px' }}>Checking AR support…</div>
        ) : (
          <>
            <div style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center', maxWidth: '260px' }}>
              {mode === 'place'
                ? 'Open AR camera, point at a surface, then tap to place the box'
                : 'Open AR camera and tap the box to claim it!'}
            </div>
            <button className="btn btn-primary" onClick={startAR} style={{ fontSize: '16px', padding: '14px 32px' }}>
              📷 Open AR Camera
            </button>
          </>
        )}
      </div>
    );
  }

  // AR active — DOM overlay (camera passthrough provided by WebXR)
  return (
    <div ref={overlayRef} style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
      {/* Surface reticle */}
      {hasHit && (
        <div style={{
          position: 'absolute', bottom: '32%', left: '50%', transform: 'translateX(-50%)',
          width: '64px', height: '14px',
          background: 'rgba(117,171,200,0.45)',
          borderRadius: '50%', filter: 'blur(3px)',
        }} />
      )}

      {/* Mystery box */}
      {hasHit && (
        <div
          onClick={mode === 'claim' ? handleAction : undefined}
          style={{
            position: 'absolute', bottom: '33%', left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '88px',
            cursor: mode === 'claim' ? 'pointer' : 'default',
            animation: 'float 2s ease-in-out infinite',
            userSelect: 'none', WebkitUserSelect: 'none',
          }}
        >📦</div>
      )}

      {/* Confirm button (place mode) */}
      {mode === 'place' && hasHit && (
        <button
          className="btn btn-primary"
          onClick={handleAction}
          style={{
            position: 'absolute', bottom: '48px', left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '16px', padding: '14px 32px', minWidth: '200px',
          }}
        >
          📦 Placera här
        </button>
      )}

      {/* Scan hint */}
      {!hasHit && (
        <div style={{
          position: 'absolute', bottom: '48px', left: '50%', transform: 'translateX(-50%)',
          color: '#fff', fontSize: '14px', textAlign: 'center',
          background: 'rgba(0,0,0,0.55)', padding: '10px 20px', borderRadius: '10px',
          whiteSpace: 'nowrap',
        }}>
          Point camera at a flat surface…
        </div>
      )}

      {/* Tap hint (claim mode) */}
      {mode === 'claim' && hasHit && (
        <div style={{
          position: 'absolute', bottom: '48px', left: '50%', transform: 'translateX(-50%)',
          color: 'var(--gold)', fontSize: '15px', fontWeight: 800,
          background: 'rgba(0,0,0,0.65)', padding: '10px 20px', borderRadius: '10px',
          pointerEvents: 'none', animation: 'pulse 0.8s ease-in-out infinite',
        }}>
          TAP THE BOX!
        </div>
      )}

      {/* Close */}
      <button
        onClick={() => { sessionRef.current?.end().catch(() => {}); onClose(); }}
        style={{
          position: 'absolute', top: '24px', right: '24px',
          background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.3)',
          borderRadius: '50%', width: '40px', height: '40px',
          color: '#fff', fontSize: '18px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Sora', sans-serif",
        }}
      >✕</button>
    </div>
  );
}
