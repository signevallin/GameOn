/** @type {import('next').NextConfig} */

// Baseline security headers applied to every route.
const securityHeaders = [
  // Stop the site being framed by third parties (clickjacking).
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Don't let browsers MIME-sniff responses into a different content type.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Only send the origin (not the full path) on cross-origin navigations.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Allow the features the app uses (camera for QR/AR, geolocation for geo
  // missions) only for our own origin; disable the rest.
  { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=(), payment=()' },
  // Force HTTPS for two years, including subdomains.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@react-pdf/renderer'],
    instrumentationHook: true,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
