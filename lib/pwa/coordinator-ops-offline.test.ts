/**
 * Unit checks for coordinator offline sync status — run:
 *   npx tsx lib/pwa/coordinator-ops-offline.test.ts
 */
import assert from 'node:assert/strict'
import { resolveMutationSyncStatus } from './coordinator-ops-offline'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('coordinator-ops-offline')

test('synced is false when another mutation in the batch applied but not the current one', () => {
  const status = resolveMutationSyncStatus('mutation-b', ['mutation-a'])
  assert.equal(status.synced, false)
  assert.equal(status.queued, true)
})

test('synced is true only when the current mutation id was applied', () => {
  const status = resolveMutationSyncStatus('mutation-b', ['mutation-a', 'mutation-b'])
  assert.equal(status.synced, true)
  assert.equal(status.queued, false)
})

test('synced is false when flush applied nothing', () => {
  const status = resolveMutationSyncStatus('mutation-a', [])
  assert.equal(status.synced, false)
  assert.equal(status.queued, true)
})

console.log('All coordinator-ops-offline tests passed.')
