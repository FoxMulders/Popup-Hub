import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldHydrateCoordinatorOpsFromSnapshot } from './coordinator-ops-offline'

test('shouldHydrateCoordinatorOpsFromSnapshot is false when queue is empty', () => {
  assert.equal(shouldHydrateCoordinatorOpsFromSnapshot(0), false)
})

test('shouldHydrateCoordinatorOpsFromSnapshot is true when unsynced writes remain', () => {
  assert.equal(shouldHydrateCoordinatorOpsFromSnapshot(1), true)
  assert.equal(shouldHydrateCoordinatorOpsFromSnapshot(3), true)
})
