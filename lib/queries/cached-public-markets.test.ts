/**
 * Unit checks for public market catalog filters — run:
 *   npx tsx lib/queries/cached-public-markets.test.ts
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('cached-public-markets')

test('discover and vendor catalog queries exclude is_test markets', () => {
  const source = readFileSync(join(process.cwd(), 'lib/queries/cached-public-markets.ts'), 'utf8')
  const isTestFilters = source.match(/\.eq\('is_test', false\)/g) ?? []
  assert.ok(
    isTestFilters.length >= 3,
    `expected at least 3 is_test filters, found ${isTestFilters.length}`
  )
})

console.log('cached-public-markets: all passed')
