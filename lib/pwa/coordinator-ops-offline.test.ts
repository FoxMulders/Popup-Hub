import assert from 'node:assert/strict'
import { coordinatorMutationCommitResult } from './coordinator-ops-offline'

function testOfflineQueuesWithoutApplying() {
  const result = coordinatorMutationCommitResult('m-1', [], true)
  assert.equal(result.applied, false)
  assert.equal(result.offlineQueued, true)
}

function testOnlineAppliedWhenMutationIdPresent() {
  const result = coordinatorMutationCommitResult('m-2', ['m-1', 'm-2'], false)
  assert.equal(result.applied, true)
  assert.equal(result.offlineQueued, false)
}

function testOnlineNotAppliedWhenMutationMissingFromAppliedIds() {
  const result = coordinatorMutationCommitResult('m-3', ['m-1'], false)
  assert.equal(result.applied, false)
  assert.equal(result.offlineQueued, false)
}

testOfflineQueuesWithoutApplying()
testOnlineAppliedWhenMutationIdPresent()
testOnlineNotAppliedWhenMutationMissingFromAppliedIds()

console.log('coordinator-ops-offline.test.ts: all tests passed')
