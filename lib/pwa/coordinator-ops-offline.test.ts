/**
 * Unit checks for coordinator ops offline sync — run:
 *   npx tsx lib/pwa/coordinator-ops-offline.test.ts
 */
import assert from 'node:assert/strict'
import { coordinatorMutationSyncStatus } from './coordinator-ops-offline'

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

test('marks offline mutations as queued without synced', () => {
  const status = coordinatorMutationSyncStatus('mut-1', [], true)
  assert.equal(status.synced, false)
  assert.equal(status.queued, true)
  assert.equal(status.offline, true)
})

test('synced only when the current mutation id is applied', () => {
  const status = coordinatorMutationSyncStatus('mut-2', ['mut-1', 'mut-3'], false)
  assert.equal(status.synced, false)
  assert.equal(status.queued, true)
  assert.equal(status.offline, false)
})

test('does not treat unrelated applied ids as success for the current mutation', () => {
  const status = coordinatorMutationSyncStatus('mut-2', ['mut-1'], false)
  assert.equal(status.synced, false)
  assert.equal(status.queued, true)
})

test('reports synced when the current mutation id is applied', () => {
  const status = coordinatorMutationSyncStatus('mut-2', ['mut-1', 'mut-2'], false)
  assert.equal(status.synced, true)
  assert.equal(status.queued, false)
  assert.equal(status.offline, false)
})

console.log('All coordinator-ops-offline tests passed.')
