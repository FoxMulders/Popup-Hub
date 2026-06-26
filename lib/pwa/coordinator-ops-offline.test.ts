/**
 * Unit checks for coordinator offline sync helpers — run:
 *   npx tsx lib/pwa/coordinator-ops-offline.test.ts
 */
import assert from 'node:assert/strict'
import { resolveCommitSyncStatus } from './coordinator-ops-offline'

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

test('resolveCommitSyncStatus reports synced only when this mutation id was applied', () => {
  const current = 'mutation-b'
  const appliedIds = ['mutation-a']

  const result = resolveCommitSyncStatus(current, appliedIds)
  assert.equal(result.synced, false)
  assert.equal(result.queued, true)
})

test('resolveCommitSyncStatus does not false-positive when another mutation synced', () => {
  const current = 'mutation-b'
  const appliedIds = ['mutation-a', 'mutation-b']

  const result = resolveCommitSyncStatus(current, appliedIds)
  assert.equal(result.synced, true)
  assert.equal(result.queued, false)
})

test('resolveCommitSyncStatus marks queued when flush applied nothing', () => {
  const result = resolveCommitSyncStatus('mutation-a', [])
  assert.equal(result.synced, false)
  assert.equal(result.queued, true)
})

console.log('All coordinator-ops-offline tests passed.')
