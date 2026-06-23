/**
 * Unit checks for payment deadline resolution — run:
 *   npx tsx lib/applications/payment-deadline.test.ts
 */
import assert from 'node:assert/strict'
import {
  PAYMENT_CUTOFF_DAYS_BEFORE_EVENT,
  PAYMENT_DUE_HOURS_AFTER_APPROVAL,
  resolvePaymentDueAt,
} from './payment-deadline'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

const eventStart = '2026-07-01T14:00:00.000Z'

console.log('resolvePaymentDueAt')

test('uses approval + 72h when that is before event cutoff', () => {
  const anchor = '2026-06-01T10:00:00.000Z'
  const now = new Date('2026-06-01T10:00:00.000Z')
  const due = resolvePaymentDueAt({ anchorAt: anchor, eventStartAt: eventStart, now })
  const expected = new Date(now.getTime() + PAYMENT_DUE_HOURS_AFTER_APPROVAL * 60 * 60 * 1000)
  assert.equal(due, expected.toISOString())
})

test('uses event cutoff when that is sooner than approval + 72h', () => {
  const anchor = '2026-06-22T10:00:00.000Z'
  const now = new Date('2026-06-22T10:00:00.000Z')
  const due = resolvePaymentDueAt({ anchorAt: anchor, eventStartAt: eventStart, now })
  const eventStartDate = new Date(eventStart)
  const expected = new Date(
    eventStartDate.getTime() - PAYMENT_CUTOFF_DAYS_BEFORE_EVENT * 24 * 60 * 60 * 1000
  )
  assert.equal(due, expected.toISOString())
})

test('honours stricter per-event override', () => {
  const anchor = '2026-06-01T10:00:00.000Z'
  const override = '2026-06-03T18:00:00.000Z'
  const now = new Date('2026-06-01T10:00:00.000Z')
  const due = resolvePaymentDueAt({
    anchorAt: anchor,
    eventStartAt: eventStart,
    eventPaymentDueAt: override,
    now,
  })
  assert.equal(due, override)
})

console.log('All payment-deadline tests passed.')
