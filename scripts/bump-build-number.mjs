import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const buildFile = join(root, 'build-number.json')

function readPackageVersion() {
  try {
    const raw = readFileSync(join(root, 'package.json'), 'utf8')
    return JSON.parse(raw).version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

function parseSemver(version) {
  const match = String(version).trim().match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  }
}

function semverLabel(parts) {
  return `${parts.major}.${parts.minor}.${parts.patch}`
}

function semverChanged(previous, current) {
  const prev = parseSemver(previous)
  const next = parseSemver(current)
  if (!prev || !next) return previous !== current
  return (
    prev.major !== next.major ||
    prev.minor !== next.minor ||
    prev.patch !== next.patch
  )
}

function readGitCommit() {
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

function readBuildState() {
  try {
    const raw = readFileSync(buildFile, 'utf8')
    const data = JSON.parse(raw)
    const version =
      typeof data.version === 'string' ? data.version : readPackageVersion()
    const semver = parseSemver(version) ?? parseSemver(readPackageVersion())
    return {
      version,
      major: Number.isFinite(data.major) ? data.major : semver?.major ?? 0,
      minor: Number.isFinite(data.minor) ? data.minor : semver?.minor ?? 0,
      patch: Number.isFinite(data.patch) ? data.patch : semver?.patch ?? 0,
      build: Number.isFinite(data.build) ? data.build : 0,
      iosBuild: Number.isFinite(data.iosBuild) ? data.iosBuild : undefined,
      commit: typeof data.commit === 'string' ? data.commit : '',
    }
  } catch {
    const version = readPackageVersion()
    const semver = parseSemver(version)
    return {
      version,
      major: semver?.major ?? 0,
      minor: semver?.minor ?? 0,
      patch: semver?.patch ?? 0,
      build: 0,
      commit: '',
    }
  }
}

const packageVersion = readPackageVersion()
const packageSemver = parseSemver(packageVersion)
const commit = readGitCommit()
const state = readBuildState()

// prebuild runs before every `npm run build`; bump the counter within the current semver.
let nextBuild = state.build

if (semverChanged(state.version, packageVersion)) {
  nextBuild = 1
} else {
  nextBuild = state.build + 1
}

const nextState = {
  version: packageVersion,
  major: packageSemver?.major ?? state.major,
  minor: packageSemver?.minor ?? state.minor,
  patch: packageSemver?.patch ?? state.patch,
  build: nextBuild,
  commit,
}

if (Number.isFinite(state.iosBuild)) {
  nextState.iosBuild = state.iosBuild
}

writeFileSync(buildFile, `${JSON.stringify(nextState, null, 2)}\n`)

const versionLabel = packageSemver ? semverLabel(packageSemver) : packageVersion
console.log(
  `Build number: ${state.build} → ${nextBuild} (v${versionLabel}, ${commit})`
)
