/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable all fetch caching globally — every API call fetches fresh data
  experimental: {
    fetchCache: 'force-no-store',
  },
};

module.exports = nextConfig;
