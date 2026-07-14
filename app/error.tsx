'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error]', error);
    // Report to the server so it reaches the capture pipeline (log + alert).
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message, digest: error.digest, where: 'app/error' }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--bg, #0D1520)',
        color: 'var(--text, #DCE4EE)',
        fontFamily: "'Sora', sans-serif",
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: 420 }}>
        <p style={{ fontSize: 40, margin: '0 0 8px' }}>🎮</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>Something went wrong</h1>
        <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.8, margin: '0 0 24px' }}>
          An unexpected error interrupted the game. You can try again — if it keeps happening,
          email us at hello@rivalry.se.
        </p>
        <button
          onClick={reset}
          style={{
            padding: '12px 28px',
            background: 'var(--accent, #7CBDD4)',
            color: 'var(--bg, #0D1520)',
            fontWeight: 800,
            fontSize: 15,
            border: 'none',
            borderRadius: 999,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
