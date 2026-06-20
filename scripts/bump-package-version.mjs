import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const packageFile = join(root, 'package.json')
const lockFile = join(root, 'package-lock.json')

/** Baseline commit where product semver was set to 1.0.0. */
const HISTORY_BASELINE_COMMIT = '8aea984'

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

/** Map conventional commit prefix to semver bump kind. */
function inferVersionBumpKind(message) {
  const trimmed = String(message ?? '').trim()
  if (!trimmed) return 'none'
  if (/^major(\(|:)/i.test(trimmed)) return 'major'
  if (/^feat(\(|:)/i.test(trimmed)) return 'minor'
  if (/^fix(\(|:)/i.test(trimmed)) return 'patch'
  return 'none'
}

function bumpSemverParts(parts, kind) {
  switch (kind) {
    case 'major':
      return { major: parts.major + 1, minor: 0, patch: 0 }
    case 'minor':
      return { major: parts.major, minor: parts.minor + 1, patch: 0 }
    case 'patch':
      return { major: parts.major, minor: parts.minor, patch: parts.patch + 1 }
    default:
      return parts
  }
}

function readPackageVersion() {
  const raw = readFileSync(packageFile, 'utf8')
  return JSON.parse(raw).version ?? '0.0.0'
}

function writePackageVersion(nextVersion) {
  const pkg = JSON.parse(readFileSync(packageFile, 'utf8'))
  pkg.version = nextVersion
  writeFileSync(packageFile, `${JSON.stringify(pkg, null, 4)}\n`)

  try {
    const lock = JSON.parse(readFileSync(lockFile, 'utf8'))
    lock.version = nextVersion
    if (lock.packages?.['']) {
      lock.packages[''].version = nextVersion
    }
    writeFileSync(lockFile, `${JSON.stringify(lock, null, 4)}\n`)
  } catch {
    // package-lock optional in some environments
  }
}

function simulateVersionFromMessages(messages, start = { major: 1, minor: 0, patch: 0 }) {
  let parts = { ...start }
  for (const message of messages) {
    const kind = inferVersionBumpKind(message)
    if (kind === 'none') continue
    parts = bumpSemverParts(parts, kind)
  }
  return semverLabel(parts)
}

function readGitCommitMessages(sinceCommit) {
  const range = sinceCommit ? `${sinceCommit}..HEAD` : 'HEAD'
  const output = execSync(`git log ${range} --reverse --format=%s`, {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim()
  if (!output) return []
  return output.split('\n')
}

function parseArgs(argv) {
  const args = { message: '', fromHistory: false, dryRun: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--message' && argv[i + 1]) {
      args.message = argv[++i]
    } else if (arg === '--from-history') {
      args.fromHistory = true
    } else if (arg === '--dry-run') {
      args.dryRun = true
    }
  }
  return args
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const current = readPackageVersion()

  let nextVersion = current
  let kind = 'none'

  if (args.fromHistory) {
    const messages = readGitCommitMessages(HISTORY_BASELINE_COMMIT)
    nextVersion = simulateVersionFromMessages(messages)
    kind = 'history'
  } else if (args.message) {
    kind = inferVersionBumpKind(args.message)
    const parts = parseSemver(current)
    if (!parts) {
      console.error(`Invalid current version: ${current}`)
      process.exit(1)
    }
    if (kind === 'none') {
      console.log(`Version unchanged: v${current} (${args.message.split('\n')[0]})`)
      return
    }
    nextVersion = semverLabel(bumpSemverParts(parts, kind))
  } else {
    console.error('Usage: node scripts/bump-package-version.mjs --message "feat: ..."')
    console.error('       node scripts/bump-package-version.mjs --from-history [--dry-run]')
    process.exit(1)
  }

  if (nextVersion === current) {
    console.log(`Version unchanged: v${current}`)
    return
  }

  if (args.dryRun) {
    console.log(`Would bump: v${current} → v${nextVersion} (${kind})`)
    return
  }

  writePackageVersion(nextVersion)
  console.log(`Version: v${current} → v${nextVersion} (${kind})`)
}

main()
