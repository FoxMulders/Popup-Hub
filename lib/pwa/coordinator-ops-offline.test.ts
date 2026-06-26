/**
 * Offline ops sync result semantics — run:
 *   npx tsx lib/pwa/coordinator-ops-offline.test.ts
 */
import assert from 'node:assert/strict'
import { coordinatorMutationWasApplied } from './coordinator-ops-offline'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('coordinatorMutationWasApplied')

test('returns true only when the mutation id is in appliedIds', () => {
  assert.equal(
    coordinatorMutationWasApplied('current', {
      appliedIds: ['stale', 'current'],
      remaining: 1,
    }),
    true
  )
})

test('returns false when another mutation synced but not the current one', () => {
  assert.equal(
    coordinatorMutationWasApplied('current', {
      appliedIds: ['stale'],
      remaining: 2,
    }),
    false
  )
})

test('returns false when flush applied nothing', () => {
  assert.equal(
    coordinatorMutationWasApplied('current', {
      appliedIds: [],
      remaining: 3,
    }),
    false
  )
})

console.log('\nAll coordinator-ops-offline tests passed.')
