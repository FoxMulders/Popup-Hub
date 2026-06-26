import assert from 'node:assert/strict'
import { coordinatorOpsPersistPlan } from './coordinator-ops-offline'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    throw error
  }
}

test('online sync success uses synced path', () => {
  assert.equal(coordinatorOpsPersistPlan({ offline: false, synced: true }), 'synced')
})

test('offline queues without direct fallback', () => {
  assert.equal(coordinatorOpsPersistPlan({ offline: true, synced: false }), 'offline-queued')
})

test('online sync failure falls back to direct persist', () => {
  assert.equal(coordinatorOpsPersistPlan({ offline: false, synced: false }), 'direct-fallback')
})
