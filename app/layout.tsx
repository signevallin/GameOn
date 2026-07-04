import type { Metadata } from 'next';
import CookieConsent from '@/components/CookieConsent';
import './globals.css';

const BASE_URL = 'https://playgameon.app';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),

  title: {
    default: 'GameOn — Turn any event into an epic game',
    template: '%s | GameOn',
  },
  description:
    'Real-time team competitions with live leaderboards, photo missions and power-ups. No app required — teams join in seconds with a 6-digit code.',

  keywords: [
    'team building',
    'företagsevent',
    'teambuilding',
    'live leaderboard',
    'photo missions',
    'gamification',
    'event app',
    'konferens aktivitet',
    'kickoff',
  ],

  authors: [{ name: 'GameOn', url: BASE_URL }],
  creator: 'GameOn',
  publisher: 'GameOn',

  /* ── Open Graph ─────────────────────────────────────────── */
  openGraph: {
    type: 'website',
    url: BASE_URL,
    siteName: 'GameOn',
    title: 'GameOn — Turn any event into an epic game',
    description:
      'Real-time leaderboards, photo missions and power-ups. Zero app downloads — teams join in seconds.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'GameOn — Turn any event into an epic game',
      },
    ],
    locale: 'sv_SE',
    alternateLocale: 'en_US',
  },

  /* ── Twitter / X ────────────────────────────────────────── */
  twitter: {
    card: 'summary_large_image',
    title: 'GameOn — Turn any event into an epic game',
    description:
      'Real-time leaderboards, photo missions and power-ups. Zero app downloads.',
    images: ['/opengraph-image'],
  },

  /* ── Robots ─────────────────────────────────────────────── */
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },

  /* ── Icons ──────────────────────────────────────────────── */
  icons: {
    icon: '/GameOn-AppIcon-1024.png',
    apple: '/GameOn-AppIcon-1024.png',
  },

  /* ── PWA / mobile ───────────────────────────────────────── */
  applicationName: 'GameOn',
  appleWebApp: {
    capable: true,
    title: 'Game⏻n',
    statusBarStyle: 'black-translucent',
  },

  /* ── Verification (add when you connect Search Console) ─── */
  // verification: { google: 'YOUR_TOKEN_HERE' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;600&family=Inter:wght@300;400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}<CookieConsent /></body>
    </html>
  );
}
