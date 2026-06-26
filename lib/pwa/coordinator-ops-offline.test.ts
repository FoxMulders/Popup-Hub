/**
 * Run: npx tsx lib/pwa/coordinator-ops-offline.test.ts
 */
import assert from 'node:assert/strict'
import { interpretMutationCommitResult } from './coordinator-ops-offline'
import { pickPaymentStatusUpdates } from '@/lib/coordinator/ops-sync-payment-updates'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (error) {
    console.error(`  ✗ ${name}`)
    throw error
  }
}

console.log('coordinator-ops-offline tests')

test('mutation is synced only when its id is no longer pending', () => {
  const currentId = 'mutation-b'
  const pending = [{ id: 'mutation-a' }, { id: currentId }]

  assert.deepEqual(interpretMutationCommitResult(currentId, pending), {
    queued: true,
    synced: false,
  })
  assert.deepEqual(interpretMutationCommitResult(currentId, [{ id: 'mutation-a' }]), {
    queued: false,
    synced: true,
  })
})

test('other mutations syncing must not mark the current mutation as synced', () => {
  const currentId = 'mutation-b'
  const pending = [{ id: currentId }]

  const result = interpretMutationCommitResult(currentId, pending)
  assert.equal(result.synced, false)
  assert.equal(result.queued, true)
})

test('payment status sync whitelists only payment fields', () => {
  assert.deepEqual(
    pickPaymentStatusUpdates({
      payment_status: 'paid',
      application_payment_status: 'COMPLETED',
      status: 'approved',
      vendor_id: 'evil',
    }),
    {
      payment_status: 'paid',
      application_payment_status: 'COMPLETED',
    }
  )
})

console.log('\nAll coordinator-ops-offline tests passed.')
