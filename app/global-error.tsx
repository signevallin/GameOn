'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global error]', error);
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: error.message, digest: error.digest, where: 'app/global-error' }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#0D1520',
          color: '#DCE4EE',
          fontFamily: 'Helvetica, Arial, sans-serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <p style={{ fontSize: 40, margin: '0 0 8px' }}>🎮</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 12px' }}>Something went wrong</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, opacity: 0.8, margin: '0 0 24px' }}>
            An unexpected error interrupted Rivalry. Please try again — if it keeps happening,
            email us at hello@playgameon.app.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '12px 28px',
              background: '#7CBDD4',
              color: '#0D1520',
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
      </body>
    </html>
  );
}
