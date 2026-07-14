import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rivalry — Turn any event into an epic game',
    short_name: 'Rivalry',
    description:
      'Real-time team competitions with live leaderboards, photo missions and power-ups. No app required.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0D1520',
    theme_color: '#0D1520',
    icons: [
      {
        src: '/rivalry-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
