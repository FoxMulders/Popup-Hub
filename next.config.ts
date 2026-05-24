import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // All pages are dynamic — no static prerendering for an auth-protected marketplace
  output: 'standalone',
  serverExternalPackages: ['square', 'twilio'],
  // Allow phone/tablet on LAN to load dev HMR (e.g. https://192.168.x.x:3000)
  allowedDevOrigins: ['192.168.1.113', '127.0.0.1', 'localhost'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}

export default nextConfig
