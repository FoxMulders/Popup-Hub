import { spawnSync } from 'node:child_process'
import { existsSync, renameSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const projectRoot = resolve(join(import.meta.dirname, '..'))
const nextDir = join(projectRoot, '.next')
const strict = process.argv.includes('--strict')
const stopDev = process.argv.includes('--stop-dev')

function removeDir(dir) {
  rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 })
}

function normalizePathForMatch(value) {
  return value.toLowerCase().replace(/\//g, '\\')
}

function isNextDevForProject(commandLine) {
  if (!commandLine) return false
  const lower = normalizePathForMatch(commandLine)
  const root = normalizePathForMatch(projectRoot)
  if (!lower.includes(root)) return false
  if (/\bnext(\.cmd)?\b/.test(lower) && /\bdev\b/.test(lower)) return true
  return lower.includes('start-server.js')
}

function listDevServerPids() {
  if (process.platform === 'win32') {
    const result = spawnSync(
      'powershell',
      [
        '-NoProfile',
        '-Command',
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { $_.CommandLine } | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress",
      ],
      { encoding: 'utf8' }
    )
    if (result.status !== 0 || !result.stdout.trim()) return []
    let rows
    try {
      rows = JSON.parse(result.stdout)
    } catch {
      return []
    }
    if (!Array.isArray(rows)) rows = [rows]
    return rows
      .filter((row) => isNextDevForProject(row.CommandLine))
      .map((row) => Number(row.ProcessId))
      .filter((pid) => Number.isInteger(pid) && pid > 0)
  }

  const result = spawnSync('ps', ['-ax', '-o', 'pid=,command='], { encoding: 'utf8' })
  if (result.status !== 0) return []
  const pids = []
  for (const line of result.stdout.split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(.*)$/)
    if (!match) continue
    const pid = Number(match[1])
    const command = match[2]
    if (isNextDevForProject(command)) pids.push(pid)
  }
  return pids
}

function pauseAfterStop(ms) {
  if (process.platform === 'win32') {
    spawnSync('powershell', ['-NoProfile', '-Command', `Start-Sleep -Milliseconds ${ms}`], {
      stdio: 'ignore',
    })
    return
  }
  spawnSync('sleep', [String(Math.max(1, Math.ceil(ms / 1000)))], { stdio: 'ignore' })
}

function stopDevServers(pids) {
  if (pids.length === 0) return
  console.log(`Stopping ${pids.length} local next dev process${pids.length === 1 ? '' : 'es'} before production build`)
  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
      } else {
        process.kill(pid)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Warning: could not stop dev server pid ${pid} (${message})`)
    }
  }
  pauseAfterStop(2000)
}

function ensureDevServersStopped() {
  let pids = listDevServerPids()
  if (pids.length === 0) return true

  if (stopDev) {
    for (let attempt = 0; attempt < 3 && pids.length > 0; attempt += 1) {
      stopDevServers(pids)
      pids = listDevServerPids()
    }
  }

  if (pids.length === 0) return true

  console.error(
    `Found ${pids.length} running next dev process${pids.length === 1 ? '' : 'es'} for this repo (pids: ${pids.join(', ')}).`
  )
  console.error('Stop them before production build, or rerun with --stop-dev.')
  return false
}

function cleanNextBuildDir() {
  if (!existsSync(nextDir)) {
    console.log('No .next build cache to remove')
    return true
  }

  try {
    removeDir(nextDir)
    console.log('Removed .next build cache')
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    // Windows: dev server or a prior build may lock files — rename aside, then delete.
    try {
      const trashDir = `${nextDir}.delete-${Date.now()}`
      renameSync(nextDir, trashDir)
      removeDir(trashDir)
      console.log('Removed .next build cache (via rename)')
      return true
    } catch (renameError) {
      const renameMessage =
        renameError instanceof Error ? renameError.message : String(renameError)
      console.warn(`Warning: could not remove .next (${message}; rename: ${renameMessage})`)
      return false
    }
  }
}

const devOk = ensureDevServersStopped()
const cleanOk = devOk && cleanNextBuildDir()

if (strict && !cleanOk) {
  process.exit(1)
}
