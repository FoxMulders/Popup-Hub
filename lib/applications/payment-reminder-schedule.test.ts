/**
 * Unit checks for payment reminder escalation — run:
 *   npx tsx lib/applications/payment-reminder-schedule.test.ts
 */
import assert from 'node:assert/strict'
import { resolveNextReminderStage } from './payment-reminder-schedule'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

const HOUR_MS = 60 * 60 * 1000

console.log('resolveNextReminderStage')

test('sends stage 1 when no reminders sent and more than 6h remain', () => {
  assert.deepEqual(resolveNextReminderStage(50 * HOUR_MS, 0), { stage: 1, kind: 'reminder' })
})

test('sends stage 2 within 24h but more than 6h remain', () => {
  assert.deepEqual(resolveNextReminderStage(12 * HOUR_MS, 1), { stage: 2, kind: 'reminder' })
})

test('sends stage 3 final warning within 6h', () => {
  assert.deepEqual(resolveNextReminderStage(3 * HOUR_MS, 2), { stage: 3, kind: 'reminder' })
})

test('returns null when past due', () => {
  assert.equal(resolveNextReminderStage(0, 0), null)
})

test('skips stage 2 when already at stage 2', () => {
  assert.equal(resolveNextReminderStage(12 * HOUR_MS, 2), null)
})

console.log('All payment-reminder-schedule tests passed.')
