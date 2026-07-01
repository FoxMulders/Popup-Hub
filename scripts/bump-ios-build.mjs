import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const buildFile = join(root, 'build-number.json')

function readBuildMeta() {
  const raw = readFileSync(buildFile, 'utf8')
  return JSON.parse(raw)
}

const data = readBuildMeta()
const previous = Number.isFinite(data.iosBuild) ? data.iosBuild : 0
const next = previous + 1

data.iosBuild = next
writeFileSync(buildFile, `${JSON.stringify(data, null, 2)}\n`)

console.log(`iOS build number: ${previous} → ${next}`)
