'use client';

import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/next';

type Choice = 'accepted' | 'declined';
const STORAGE_KEY = 'gameon-cookie-consent';

/**
 * GDPR/ePrivacy-compliant consent gate for analytics. Vercel Analytics only
 * loads after the visitor explicitly accepts; necessary cookies (login) are
 * unaffected. The choice is remembered in localStorage.
 */
export default function CookieConsent() {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Choice | null;
      if (stored === 'accepted' || stored === 'declined') setChoice(stored);
    } catch {
      /* localStorage unavailable — show the banner, don't crash */
    }
    setReady(true);
  }, []);

  function decide(next: Choice) {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore write failure */
    }
    setChoice(next);
  }

  if (!ready) return null;

  return (
    <>
      {choice === 'accepted' && <Analytics />}

      {choice === null && (
        <div
          role="dialog"
          aria-label="Cookie consent"
          style={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            right: 16,
            zIndex: 9999,
            maxWidth: 620,
            margin: '0 auto',
            background: '#162030',
            border: '1px solid rgba(124,189,212,0.25)',
            borderRadius: 16,
            padding: '18px 20px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
            fontFamily: "'Sora', sans-serif",
            color: '#DCE4EE',
          }}
        >
          <p style={{ margin: 0, flex: '1 1 260px', fontSize: 13.5, lineHeight: 1.6, color: '#8FA8C0' }}>
            We use necessary cookies to run GameOn. With your consent we also use
            privacy-friendly analytics to improve the product. See our{' '}
            <a href="/privacy" style={{ color: '#7CBDD4', textDecoration: 'underline' }}>
              privacy policy
            </a>
            .
          </p>
          <div style={{ display: 'flex', gap: 10, flex: '0 0 auto' }}>
            <button
              onClick={() => decide('declined')}
              style={{
                padding: '10px 18px',
                background: 'transparent',
                color: '#8FA8C0',
                fontWeight: 700,
                fontSize: 13.5,
                border: '1px solid rgba(124,189,212,0.3)',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              Decline
            </button>
            <button
              onClick={() => decide('accepted')}
              style={{
                padding: '10px 20px',
                background: '#7CBDD4',
                color: '#0D1520',
                fontWeight: 800,
                fontSize: 13.5,
                border: 'none',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              Accept
            </button>
          </div>
        </div>
      )}
    </>
  );
}
