import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'GameOn — Turn any event into an epic game';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0D1520',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: 'absolute',
            top: '-200px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '900px',
            height: '900px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,189,212,0.18) 0%, transparent 65%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-150px',
            right: '-100px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,189,212,0.08) 0%, transparent 70%)',
          }}
        />

        {/* Icon */}
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, #7CBDD4, #4890aa)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '28px',
            boxShadow: '0 0 48px rgba(124,189,212,0.5)',
          }}
        >
          {/* Power button SVG */}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0D1520" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v7"/>
            <path d="M7.2 6.2A8 8 0 1 0 16.8 6.2"/>
          </svg>
        </div>

        {/* Wordmark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: '80px',
            fontWeight: 800,
            letterSpacing: '-3px',
            marginBottom: '20px',
          }}
        >
          <span style={{ color: '#DCE4EE' }}>Game</span>
          <span style={{ color: '#7CBDD4' }}>On</span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#8FA8C0',
            letterSpacing: '-0.5px',
            marginBottom: '48px',
            textAlign: 'center',
            maxWidth: '700px',
          }}
        >
          Turn any event into an epic game
        </div>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {['Live Leaderboards', 'Photo Missions', 'Power-Ups', 'No App Required'].map(f => (
            <div
              key={f}
              style={{
                padding: '10px 20px',
                borderRadius: '999px',
                border: '1px solid rgba(124,189,212,0.3)',
                background: 'rgba(124,189,212,0.07)',
                fontSize: '16px',
                fontWeight: 700,
                color: '#A8D4E6',
                letterSpacing: '0.02em',
              }}
            >
              {f}
            </div>
          ))}
        </div>

        {/* Domain */}
        <div
          style={{
            position: 'absolute',
            bottom: '36px',
            fontSize: '18px',
            fontWeight: 700,
            color: '#4A6580',
            letterSpacing: '0.08em',
          }}
        >
          playgameon.app
        </div>
      </div>
    ),
    { ...size }
  );
}
