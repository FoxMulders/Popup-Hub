import { existsSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const nextDir = join(import.meta.dirname, '..', '.next')
const strict = process.argv.includes('--strict')

function removeDir(dir) {
  rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 })
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

const ok = cleanNextBuildDir()
if (strict && !ok) {
  process.exit(1)
}
