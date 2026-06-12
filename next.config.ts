import type { NextConfig } from 'next'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { formatAppVersion } from './lib/build-info'
import { getURL } from './lib/url/public-app-url'

function readPackageVersion(): string {
  try {
    const raw = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    return (JSON.parse(raw) as { version?: string }).version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function readGitCommit(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
  }
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'local'
  }
}

function readBuildNumber(): number {
  try {
    const raw = readFileSync(join(process.cwd(), 'build-number.json'), 'utf8')
    const data = JSON.parse(raw) as { build?: number }
    if (Number.isFinite(data.build)) return data.build as number
  } catch {
    // fall through
  }
  return 0
}

const buildTime = new Date().toISOString()
const buildCommit = readGitCommit()
const buildNumber = readBuildNumber()
const baseVersion = readPackageVersion()
const appVersion = formatAppVersion(baseVersion)

function resolvePublicAppUrlEnv(): string {
  return getURL()
}

const nextConfig: NextConfig = {
  // All pages are dynamic — no static prerendering for an auth-protected marketplace
  output: 'standalone',
  serverExternalPackages: ['square', 'twilio'],
  // Allow phone/tablet on LAN to load dev HMR (e.g. https://192.168.x.x:3000)
  allowedDevOrigins: ['192.168.1.113', '127.0.0.1', 'localhost'],
  env: {
    NEXT_PUBLIC_APP_URL: resolvePublicAppUrlEnv(),
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_GIT_HASH: buildCommit,
    NEXT_PUBLIC_APP_VERSION_BASE: baseVersion,
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
    NEXT_PUBLIC_BUILD_NUMBER: String(buildNumber),
    NEXT_PUBLIC_BUILD_TIME: buildTime,
    // Accept GOOGLE_MAPS_API_KEY from Vercel when NEXT_PUBLIC_* was not set separately.
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
      process.env.GOOGLE_MAPS_API_KEY?.trim() ||
      '',
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
        ],
      },
    ]
  },
}

export default nextConfig
