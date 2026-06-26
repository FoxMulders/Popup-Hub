/**
 * Coordinator ops offline sync status — run:
 *   npx tsx lib/pwa/coordinator-ops-offline.test.ts
 */
import assert from 'node:assert/strict'
import { resolveMutationSyncResult } from './coordinator-ops-offline'

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

test('partial batch flush does not mark unrelated mutation as synced', () => {
  const result = resolveMutationSyncResult('mutation-b', ['mutation-a'], ['mutation-b'])
  assert.deepEqual(result, { synced: false, queued: true })
})

test('current mutation synced when its id is in appliedIds', () => {
  const result = resolveMutationSyncResult('mutation-b', ['mutation-a', 'mutation-b'], [])
  assert.deepEqual(result, { synced: true, queued: false })
})

test('stale applied ids alone do not imply success for current mutation', () => {
  const result = resolveMutationSyncResult('mutation-b', ['mutation-a'], ['mutation-b'])
  assert.equal(result.synced, false)
})

console.log('all coordinator-ops-offline tests passed')
