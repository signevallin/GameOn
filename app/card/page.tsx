'use client';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Image from 'next/image';

export default function CardPage() {
  const [url, setUrl] = useState('');

  useEffect(() => {
    setUrl(window.location.origin);
  }, []);

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #0a0f1e 0%, #0d1a2e 50%, #0a1218 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Sora', sans-serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: '360px',
        background: 'rgba(22, 32, 48, 0.85)',
        border: '1px solid rgba(124, 189, 212, 0.2)',
        borderRadius: '24px',
        padding: '40px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0',
        boxShadow: '0 0 60px rgba(124, 189, 212, 0.08), 0 24px 64px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Logo */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          overflow: 'hidden',
          marginBottom: '20px',
          boxShadow: '0 4px 24px rgba(124,189,212,0.2)',
        }}>
          <Image
            src="/GameOn-AppIcon-1024.png"
            alt="GameOn"
            width={80}
            height={80}
            style={{ objectFit: 'cover' }}
          />
        </div>

        {/* Name */}
        <h1 style={{
          fontSize: '32px',
          fontWeight: 800,
          color: '#e0e7f3',
          letterSpacing: '1px',
          margin: 0,
          marginBottom: '6px',
        }}>
          GameOn
        </h1>

        {/* Tagline */}
        <p style={{
          fontSize: '13px',
          color: '#7CBDD4',
          letterSpacing: '2px',
          textTransform: 'uppercase',
          fontWeight: 600,
          margin: 0,
          marginBottom: '36px',
        }}>
          Gamified Team Events
        </p>

        {/* QR Code */}
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          {url && (
            <QRCodeSVG
              value={url}
              size={180}
              bgColor="#ffffff"
              fgColor="#0d1a2e"
              level="M"
            />
          )}
        </div>

        {/* URL */}
        {url && (
          <p style={{
            fontSize: '12px',
            color: '#6e82a5',
            letterSpacing: '0.5px',
            margin: 0,
            marginBottom: '28px',
          }}>
            {url.replace(/^https?:\/\//, '')}
          </p>
        )}

        {/* Divider */}
        <div style={{
          width: '100%',
          height: '1px',
          background: 'rgba(124,189,212,0.1)',
          marginBottom: '24px',
        }} />

        {/* CTA */}
        <a
          href={url || '/'}
          style={{
            width: '100%',
            padding: '14px',
            background: 'rgba(124,189,212,0.12)',
            border: '1px solid rgba(124,189,212,0.35)',
            borderRadius: '12px',
            color: '#7CBDD4',
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textAlign: 'center',
            textDecoration: 'none',
            transition: 'all 0.15s',
            display: 'block',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(124,189,212,0.22)';
            (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(124,189,212,0.6)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(124,189,212,0.12)';
            (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(124,189,212,0.35)';
          }}
        >
          Boka din upplevelse →
        </a>
      </div>
    </div>
  );
}
