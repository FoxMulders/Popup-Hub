import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type BuildEnvironment = 'development' | 'preview' | 'production' | 'local'

export interface BuildInfo {
  version: string
  baseVersion: string
  commit: string
  buildNumber: number
  builtAt: string
  environment: BuildEnvironment
  label: string
}

/** Public `/version` JSON payload. */
export interface SiteVersionPayload {
  version: string
  build: string
  geminiConfigured: boolean
  /** True when OPENROUTER_API_KEY is set (preferred AI gateway). */
  openRouterConfigured: boolean
}

function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim())
}

function isAiConfigured(): boolean {
  if (isOpenRouterConfigured()) return true
  return ['GEMINI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY', 'GOOGLE_GEMINI_API_KEY', 'GROQ_API_KEY', 'POPUPHUB_API_KEY'].some(
    (key) => Boolean(process.env[key]?.trim())
  )
}

/** Parsed semver components from `major.minor.patch`. */
export interface SemverParts {
  major: number
  minor: number
  patch: number
}

export function parseSemver(version: string): SemverParts | null {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

/** Display version: `major.minor.patch` from package.json (build counter is shown separately). */
export function formatAppVersion(baseVersion: string): string {
  const parts = parseSemver(baseVersion)
  if (parts) {
    return `${parts.major}.${parts.minor}.${parts.patch}`
  }
  return baseVersion
}

/** True when major, minor, or patch changed between two semver strings. */
export function semverComponentsChanged(
  previous: string,
  current: string
): boolean {
  const prev = parseSemver(previous)
  const next = parseSemver(current)
  if (!prev || !next) return previous !== current
  return (
    prev.major !== next.major ||
    prev.minor !== next.minor ||
    prev.patch !== next.patch
  )
}

function readPackageVersion(): string {
  try {
    const raw = readFileSync(join(process.cwd(), 'package.json'), 'utf8')
    const pkg = JSON.parse(raw) as { version?: string }
    return pkg.version ?? '0.0.0'
  } catch {
    return '0.0.0'
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

function readBuildNumber(): number {
  const fromEnv = process.env.NEXT_PUBLIC_BUILD_NUMBER?.trim()
  if (fromEnv && /^\d+$/.test(fromEnv)) return Number(fromEnv)

  try {
    const raw = readFileSync(join(process.cwd(), 'build-number.json'), 'utf8')
    const data = JSON.parse(raw) as { build?: number }
    if (Number.isFinite(data.build)) return data.build as number
  } catch {
    // fall through
  }

  return 0
}

/** Footer label: `Build: {version} · {gitHash}` or `Build: local-dev`. */
export function getBuildFooterLabel(): string {
  const version = process.env.NEXT_PUBLIC_APP_VERSION?.trim()
  const gitHash =
    process.env.NEXT_PUBLIC_GIT_HASH?.trim() ||
    process.env.NEXT_PUBLIC_BUILD_COMMIT?.trim()

  if (!version || !gitHash) {
    return 'Build: local-dev'
  }

  return `Build: ${version} · ${gitHash}`
}

/** Build metadata injected at compile time (see next.config.ts). */
export function getBuildInfo(): BuildInfo {
  const baseVersion =
    process.env.NEXT_PUBLIC_APP_VERSION_BASE?.trim() || readPackageVersion()
  const commit =
    process.env.NEXT_PUBLIC_GIT_HASH?.trim() ||
    process.env.NEXT_PUBLIC_BUILD_COMMIT?.trim() ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    'local'
  const buildNumber = readBuildNumber()
  const version =
    process.env.NEXT_PUBLIC_APP_VERSION?.trim() ||
    formatAppVersion(baseVersion)
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

  const label = getBuildFooterLabel()
  const detailLabel = `${label} · ${formatBuiltAt(builtAt)} (${envTag})`

  return {
    version,
    baseVersion,
    commit,
    buildNumber,
    builtAt,
    environment,
    label: detailLabel,
  }
}

/** `GET /version` — `version` is major.minor.patch; `build` is the git hash. */
export function getSiteVersionPayload(): SiteVersionPayload {
  const build = getBuildInfo()
  return {
    version: build.version,
    build: build.commit,
    geminiConfigured: isAiConfigured(),
    openRouterConfigured: isOpenRouterConfigured(),
  }
}
