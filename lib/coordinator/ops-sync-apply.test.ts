/**
 * Unit checks for coordinator ops-sync apply helpers — run:
 *   npx tsx lib/coordinator/ops-sync-apply.test.ts
 */
import assert from 'node:assert/strict'
import { rowUpdateSucceeded } from './ops-sync-apply'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('ops-sync-apply')

test('returns true when a row was updated', () => {
  assert.equal(rowUpdateSucceeded({ id: 'app-1' }, null), true)
})

test('returns false when Supabase reports an error', () => {
  assert.equal(rowUpdateSucceeded(null, { message: 'permission denied' }), false)
})

test('returns false when zero rows matched the update', () => {
  assert.equal(rowUpdateSucceeded(null, null), false)
})

console.log('All ops-sync-apply tests passed.')
