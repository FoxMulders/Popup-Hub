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
    return {
      version: typeof data.version === 'string' ? data.version : readPackageVersion(),
      build: Number.isFinite(data.build) ? data.build : 0,
      commit: typeof data.commit === 'string' ? data.commit : '',
    }
  } catch {
    return { version: readPackageVersion(), build: 0, commit: '' }
  }
}

const packageVersion = readPackageVersion()
const commit = readGitCommit()
const state = readBuildState()

const shouldBump =
  process.env.BUMP_BUILD_NUMBER === '1' ||
  (process.env.VERCEL === '1' && process.env.VERCEL_ENV === 'production')

let nextBuild = state.build
let nextCommit = state.commit

if (state.version !== packageVersion) {
  nextBuild = shouldBump ? 1 : 0
  nextCommit = shouldBump ? commit : state.commit
} else if (shouldBump) {
  const sameCommitRebuild =
    process.env.VERCEL === '1' &&
    state.commit === commit &&
    state.build > 0 &&
    process.env.BUMP_BUILD_NUMBER !== '1'

  if (sameCommitRebuild) {
    nextBuild = state.build
    nextCommit = state.commit
  } else {
    nextBuild = state.build + 1
    nextCommit = commit
  }
}

const nextState = {
  version: packageVersion,
  build: nextBuild,
  commit: nextCommit,
}

writeFileSync(buildFile, `${JSON.stringify(nextState, null, 2)}\n`)

if (shouldBump && nextBuild !== state.build) {
  console.log(`Build number: ${state.build} → ${nextBuild} (v${packageVersion}, ${commit})`)
} else if (shouldBump && nextBuild === state.build) {
  console.log(`Build number unchanged for commit ${commit}: ${nextBuild} (v${packageVersion})`)
} else {
  console.log(`Build number unchanged: ${nextBuild} (v${packageVersion})`)
}
