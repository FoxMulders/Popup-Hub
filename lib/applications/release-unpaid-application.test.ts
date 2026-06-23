/**
 * Unit checks for payment release eligibility — run:
 *   npx tsx lib/applications/release-unpaid-application.test.ts
 */
import assert from 'node:assert/strict'
import { isApplicationAwaitingBoothPayment } from './payment-fields'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('releaseUnpaidApplication eligibility')

test('releases overdue digital checkout awaiting payment', () => {
  assert.equal(
    isApplicationAwaitingBoothPayment({
      status: 'approved',
      payment_method: 'SQUARE',
      payment_status: 'payment_required',
      application_payment_status: null,
    }),
    true
  )
})

test('does not release after digital payment completes', () => {
  assert.equal(
    isApplicationAwaitingBoothPayment({
      status: 'approved',
      payment_method: 'SQUARE',
      payment_status: 'paid',
      application_payment_status: null,
    }),
    false
  )
})

test('does not release while digital payment is processing', () => {
  assert.equal(
    isApplicationAwaitingBoothPayment({
      status: 'approved',
      payment_method: 'STRIPE',
      payment_status: 'processing',
      application_payment_status: null,
    }),
    false
  )
})

test('does not release after offline payment is marked completed', () => {
  assert.equal(
    isApplicationAwaitingBoothPayment({
      status: 'approved',
      payment_method: 'ETRANSFER',
      payment_status: 'paid',
      application_payment_status: 'COMPLETED',
    }),
    false
  )
})

test('releases overdue offline payment still pending review', () => {
  assert.equal(
    isApplicationAwaitingBoothPayment({
      status: 'approved',
      payment_method: 'ETRANSFER',
      payment_status: 'pending',
      application_payment_status: 'PENDING_REVIEW',
    }),
    true
  )
})

console.log('All release-unpaid-application tests passed.')
