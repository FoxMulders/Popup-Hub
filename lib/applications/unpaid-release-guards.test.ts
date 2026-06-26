/**
 * Guards for payment-chase auto-release — run:
 *   npx tsx lib/applications/unpaid-release-guards.test.ts
 */
import assert from 'node:assert/strict'
import { unpaidReleaseRowGuards } from './payment-fields'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('unpaidReleaseRowGuards tests')

test('requires payment_required for digital checkout rows', () => {
  assert.deepEqual(
    unpaidReleaseRowGuards({
      payment_method: 'SQUARE',
      payment_status: 'payment_required',
      application_payment_status: null,
    }),
    { column: 'payment_status', value: 'payment_required' }
  )
})

test('requires PENDING_REVIEW for offline rows awaiting funds', () => {
  assert.deepEqual(
    unpaidReleaseRowGuards({
      payment_method: 'ETRANSFER',
      payment_status: 'pending',
      application_payment_status: 'PENDING_REVIEW',
    }),
    { column: 'application_payment_status', value: 'PENDING_REVIEW' }
  )
})

test('uses offline guard for cash payments', () => {
  assert.deepEqual(
    unpaidReleaseRowGuards({
      payment_method: 'CASH',
      payment_status: 'pending',
      application_payment_status: 'PENDING_REVIEW',
    }),
    { column: 'application_payment_status', value: 'PENDING_REVIEW' }
  )
})

console.log('PASS')
