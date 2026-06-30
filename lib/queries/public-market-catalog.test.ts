/**
 * Unit checks for public market catalog filters — run:
 *   npx tsx lib/queries/public-market-catalog.test.ts
 */
import assert from 'node:assert/strict'
import { excludeTestMarkets } from './public-market-catalog'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('public-market-catalog')

test('excludeTestMarkets adds is_test = false filter', () => {
  const calls: Array<[string, unknown]> = []
  const query = {
    eq(column: string, value: unknown) {
      calls.push([column, value])
      return this
    },
  }

  const result = excludeTestMarkets(query)
  assert.equal(result, query)
  assert.deepEqual(calls, [['is_test', false]])
})

console.log('public-market-catalog: all passed')
