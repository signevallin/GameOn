import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GameOn — Play',
  description: 'Join or create a GameOn event.',
  robots: { index: false, follow: false },
};

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
