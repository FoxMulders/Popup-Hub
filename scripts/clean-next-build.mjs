import { rmSync } from 'node:fs'
import { join } from 'node:path'

const nextDir = join(import.meta.dirname, '..', '.next')

try {
  rmSync(nextDir, { recursive: true, force: true })
  console.log('Removed .next build cache')
} catch (error) {
  console.warn(`Warning: could not remove .next (${error instanceof Error ? error.message : error})`)
}
