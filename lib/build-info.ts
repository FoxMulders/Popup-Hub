import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type BuildEnvironment = 'development' | 'preview' | 'production' | 'local'

export interface BuildInfo {
  version: string
  baseVersion: string
  commit: string
  buildNumber: string
  builtAt: string
  environment: BuildEnvironment
  label: string
}

function readPackageVersion(): string {
  try {
    const raw = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'
  }
}

function resolveEnvironment(): BuildEnvironment {
  const vercelEnv = process.env.VERCEL_ENV
  if (vercelEnv === 'production') return 'production'
  if (vercelEnv === 'preview') return 'preview'
  if (process.env.NODE_ENV === 'development') return 'development'
  return 'local'
}

function formatBuiltAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Build metadata injected at compile time (see next.config.ts). */
export function getBuildInfo(): BuildInfo {
  const baseVersion =
    process.env.NEXT_PUBLIC_APP_VERSION_BASE?.trim() || readPackageVersion()
  const commit =
    process.env.NEXT_PUBLIC_BUILD_COMMIT?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    'local'
  const version =
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() || `${baseVersion}+${commit}`
  const buildNumber =
    process.env.NEXT_PUBLIC_BUILD_NUMBER?.trim() ||
    process.env.VERCEL_DEPLOYMENT_ID?.slice(-8) ||
    'local'
  const builtAt =
    process.env.NEXT_PUBLIC_BUILD_TIME?.trim() || new Date().toISOString()
  const environment = resolveEnvironment()

  const envTag =
    environment === 'production'
      ? 'prod'
      : environment === 'preview'
        ? 'preview'
        : environment === 'development'
          ? 'dev'
          : 'local'

  const label = `v${version} · deploy ${buildNumber} · ${formatBuiltAt(builtAt)} (${envTag})`

  return { version, baseVersion, commit, buildNumber, builtAt, environment, label }
}
