/**
 * Unit checks for ops-sync vendor reliability helpers — run:
 *   npx tsx lib/coordinator/ops-sync-vendor-reliability.test.ts
 */
import assert from 'node:assert/strict'
import {
  shouldApplyEarlyExitStrike,
  shouldApplyLateArrivalStrike,
} from './ops-sync-vendor-reliability'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('ops-sync-vendor-reliability')

test('applies late strike when transitioning into late', () => {
  assert.equal(shouldApplyLateArrivalStrike(null, 'late'), true)
  assert.equal(shouldApplyLateArrivalStrike('on_time', 'late'), true)
  assert.equal(shouldApplyLateArrivalStrike('on_time', 'missed'), true)
})

test('does not apply late strike when already late or missed', () => {
  assert.equal(shouldApplyLateArrivalStrike('late', 'late'), false)
  assert.equal(shouldApplyLateArrivalStrike('missed', 'late'), false)
  assert.equal(shouldApplyLateArrivalStrike('late', 'missed'), false)
})

test('does not apply late strike when clearing status', () => {
  assert.equal(shouldApplyLateArrivalStrike('late', null), false)
  assert.equal(shouldApplyLateArrivalStrike('on_time', null), false)
})

test('applies early-exit strike only on first flag', () => {
  assert.equal(shouldApplyEarlyExitStrike(false), true)
  assert.equal(shouldApplyEarlyExitStrike(true), false)
})

console.log('All ops-sync-vendor-reliability tests passed.')
