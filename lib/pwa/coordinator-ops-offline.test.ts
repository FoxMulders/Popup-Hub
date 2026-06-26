/**
 * Unit checks for coordinator ops offline commit semantics — run:
 *   npx tsx lib/pwa/coordinator-ops-offline.test.ts
 */
import assert from 'node:assert/strict'
import { coordinatorMutationCommitResult } from './coordinator-ops-offline'

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

test('offline commit stays queued and unsynced', () => {
  const result = coordinatorMutationCommitResult('mut-a', [], true)
  assert.equal(result.synced, false)
  assert.equal(result.offline, true)
  assert.equal(result.queued, true)
})

test('synced only when this mutation id was applied', () => {
  const applied = coordinatorMutationCommitResult('mut-a', ['mut-b', 'mut-a'], false)
  assert.equal(applied.synced, true)
  assert.equal(applied.offline, false)
  assert.equal(applied.queued, false)

  const failed = coordinatorMutationCommitResult('mut-c', ['mut-a', 'mut-b'], false)
  assert.equal(failed.synced, false)
  assert.equal(failed.offline, false)
  assert.equal(failed.queued, true)
})

console.log('All coordinator-ops-offline tests passed.')
