import type { NextConfig } from 'next'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

/** Unique per deploy — Vercel deployment id or local build timestamp. */
function readBuildNumber(): string {
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID?.trim()
  if (deploymentId) return deploymentId.slice(-8)
  return new Date().toISOString().replace(/\D/g, '').slice(0, 14)
}

const buildTime = new Date().toISOString()
const buildCommit = readGitCommit()
const buildNumber = readBuildNumber()
const baseVersion = readPackageVersion()
/** Semver + commit metadata; changes when source changes. */
const appVersion = `${baseVersion}+${buildCommit}`

const nextConfig: NextConfig = {
  // All pages are dynamic — no static prerendering for an auth-protected marketplace
  output: 'standalone',
  serverExternalPackages: ['square', 'twilio'],
  // Allow phone/tablet on LAN to load dev HMR (e.g. https://192.168.x.x:3000)
  allowedDevOrigins: ['192.168.1.113', '127.0.0.1', 'localhost'],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_APP_VERSION_BASE: baseVersion,
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
    NEXT_PUBLIC_BUILD_NUMBER: buildNumber,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}

export default nextConfig
