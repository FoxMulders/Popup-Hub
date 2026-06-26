/**
 * Vendor reliability scoring checks — run:
 *   npx tsx lib/coordinator/vendor-reliability-ops.test.ts
 */
import assert from 'node:assert/strict'
import { computeVendorReliabilityScore } from '@/lib/vendor-reliability'

function testLateArrivalPenalty() {
  assert.equal(
    computeVendorReliabilityScore({
      no_show_count: 0,
      left_early_count: 0,
      late_arrival_count: 1,
      poor_cleanup_strike_count: 0,
    }),
    95
  )
}

function testEarlyDeparturePenalty() {
  assert.equal(
    computeVendorReliabilityScore({
      no_show_count: 0,
      left_early_count: 1,
      late_arrival_count: 0,
      poor_cleanup_strike_count: 0,
    }),
    90
  )
}

function testScoreFloor() {
  assert.equal(
    computeVendorReliabilityScore({
      no_show_count: 10,
      left_early_count: 10,
      late_arrival_count: 10,
      poor_cleanup_strike_count: 10,
    }),
    0
  )
}

testLateArrivalPenalty()
testEarlyDeparturePenalty()
testScoreFloor()
console.log('vendor-reliability-ops.test.ts: all checks passed')
