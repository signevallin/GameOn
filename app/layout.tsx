import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IT Challenge 2026',
  description: 'The ultimate IT competition platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Game⏻n" />
        <link rel="apple-touch-icon" href="/GameOn-AppIcon-1024.png" />
        <link rel="icon" href="/GameOn-AppIcon-1024.png" />
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&family=Inter:wght@300;400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
