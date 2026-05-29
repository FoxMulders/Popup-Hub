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

// prebuild runs before every `npm run build`; always bump the monotonic counter.
let nextBuild = state.build
let nextCommit = commit

if (state.version !== packageVersion) {
  nextBuild = 1
} else {
  nextBuild = state.build + 1
}

const nextState = {
  version: packageVersion,
  build: nextBuild,
  commit: nextCommit,
}

writeFileSync(buildFile, `${JSON.stringify(nextState, null, 2)}\n`)

console.log(`Build number: ${state.build} → ${nextBuild} (v${packageVersion}, ${commit})`)
