/**
 * Unit checks for coordinator ops offline sync — run:
 *   npx tsx lib/pwa/coordinator-ops-offline.test.ts
 */
import assert from 'node:assert/strict'
import { resolveCoordinatorMutationCommitStatus } from './coordinator-ops-offline'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('coordinator-ops-offline tests')

test('marks synced only when this mutation id was applied', () => {
  const current = 'mutation-b'
  const status = resolveCoordinatorMutationCommitStatus(
    current,
    { appliedIds: ['mutation-a'] },
    { offline: false }
  )
  assert.equal(status.synced, false)
  assert.equal(status.queued, false)
})

test('marks synced when the current mutation id was applied', () => {
  const current = 'mutation-b'
  const status = resolveCoordinatorMutationCommitStatus(
    current,
    { appliedIds: ['mutation-a', 'mutation-b'] },
    { offline: false }
  )
  assert.equal(status.synced, true)
  assert.equal(status.queued, false)
})

test('queued when offline and the current mutation was not applied', () => {
  const status = resolveCoordinatorMutationCommitStatus(
    'mutation-x',
    { appliedIds: [] },
    { offline: true }
  )
  assert.equal(status.synced, false)
  assert.equal(status.queued, true)
})

test('not queued when online sync fails so callers can fall back to live writes', () => {
  const status = resolveCoordinatorMutationCommitStatus(
    'mutation-x',
    { appliedIds: [] },
    { offline: false }
  )
  assert.equal(status.synced, false)
  assert.equal(status.queued, false)
})

console.log('\nAll coordinator-ops-offline tests passed.')
