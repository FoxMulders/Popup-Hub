/**
 * Unit checks for vendor verification — run:
 *   npx tsx lib/vendor/verification.test.ts
 */
import assert from 'node:assert/strict'
import {
  RISK_SCORE_BLOCK_THRESHOLD,
  computeRiskScore,
  validateSocialHandle,
  vendorApplyBlockReason,
} from './verification'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('vendor verification')

test('empty handle is valid and optional', () => {
  const result = validateSocialHandle('')
  assert.equal(result.ok, true)
  assert.equal(result.normalized, null)
  assert.equal(result.error, undefined)
})

test('valid handle normalizes to @brand', () => {
  const result = validateSocialHandle('CastleWorld')
  assert.equal(result.ok, true)
  assert.equal(result.normalized, '@castleworld')
})

test('invalid handle returns error', () => {
  const result = validateSocialHandle('@!!!')
  assert.equal(result.ok, false)
  assert.equal(result.normalized, null)
  assert.ok(result.error)
})

test('vendorApplyBlockReason allows apply without social handle', () => {
  const reason = vendorApplyBlockReason({
    risk_score: 25,
    verification_status: 'unverified',
    account_status: 'active',
    business_number: null,
    social_handle: null,
  })
  assert.equal(reason, null)
})

test('computeRiskScore without handle adds bump and stays under block threshold', () => {
  const score = computeRiskScore({ social_handle: null })
  assert.equal(score, 25)
  assert.ok(score <= RISK_SCORE_BLOCK_THRESHOLD)
})

console.log('All vendor verification tests passed.')
