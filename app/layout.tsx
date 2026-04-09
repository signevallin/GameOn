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
        <link
          href="https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700&family=Inter:wght@300;400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
