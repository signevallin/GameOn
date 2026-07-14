import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Rivalry — Play',
  description: 'Join or create a Rivalry event.',
  robots: { index: false, follow: false },
};

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
