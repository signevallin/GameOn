'use client';
import { useEffect, useRef, useState } from 'react';

type Props = {
  onScan: (value: string) => void;
  onClose: () => void;
};

export default function QrScanner({ onScan, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<import('html5-qrcode').Html5Qrcode | null>(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled || !containerRef.current) return;

        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            if (cancelled) return;
            // Extract just the key if it's a full URL with ?key=XXXXX
            const match = decodedText.match(/[?&]key=([A-Z0-9]{4,10})/i);
            const key = match ? match[1].toUpperCase() : decodedText.trim().toUpperCase();
            onScan(key);
          },
          () => { /* ignore scan errors */ }
        );

        if (!cancelled) setStarted(true);
      } catch (e) {
        if (!cancelled) setError('Could not access camera. Please allow camera access and try again.');
        console.error(e);
      }
    }

    init();

    return () => {
      cancelled = true;
      scannerRef.current?.stop().catch(() => {}).finally(() => {
        scannerRef.current?.clear();
      });
    };
  }, [onScan]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Header */}
      <div style={{ width: '100%', maxWidth: '360px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text)' }}>Scan Game Key</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Point the camera at the QR code</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '50%', width: '36px', height: '36px',
            color: 'var(--text)', fontSize: '18px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Sora', sans-serif",
          }}
        >
          ✕
        </button>
      </div>

      {/* Camera viewport */}
      <div style={{
        width: '100%', maxWidth: '360px',
        borderRadius: '16px', overflow: 'hidden',
        border: '2px solid var(--accent)',
        boxShadow: '0 0 0 4px rgba(117,171,200,0.15)',
        position: 'relative',
        background: '#000',
      }}>
        <div id="qr-reader" ref={containerRef} style={{ width: '100%' }} />

        {/* Corner brackets overlay */}
        {started && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {[
              { top: '50%', left: '50%', transform: 'translate(-110px, -110px)', borderTop: '3px solid var(--accent)', borderLeft: '3px solid var(--accent)', borderRadius: '4px 0 0 0' },
              { top: '50%', left: '50%', transform: 'translate(88px, -110px)', borderTop: '3px solid var(--accent)', borderRight: '3px solid var(--accent)', borderRadius: '0 4px 0 0' },
              { top: '50%', left: '50%', transform: 'translate(-110px, 88px)', borderBottom: '3px solid var(--accent)', borderLeft: '3px solid var(--accent)', borderRadius: '0 0 0 4px' },
              { top: '50%', left: '50%', transform: 'translate(88px, 88px)', borderBottom: '3px solid var(--accent)', borderRight: '3px solid var(--accent)', borderRadius: '0 0 4px 0' },
            ].map((s, i) => (
              <div key={i} style={{ position: 'absolute', width: '22px', height: '22px', ...s }} />
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginTop: '20px', color: 'var(--accent2)', fontSize: '13px', textAlign: 'center', maxWidth: '300px' }}>
          {error}
        </div>
      )}

      {!started && !error && (
        <div style={{ marginTop: '20px', color: 'var(--muted)', fontSize: '13px' }}>Starting camera…</div>
      )}
    </div>
  );
}
