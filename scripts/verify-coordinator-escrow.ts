/**
 * Coordinator escrow split + vouch fast-track + pass-through checkout math.
 *
 * Run: npx tsx scripts/verify-coordinator-escrow.ts
 */

import {
  ESCROW_HOLD_PERCENT,
  ESCROW_IMMEDIATE_PERCENT,
  REQUIRED_VENDOR_VOUCHES,
  REQUIRED_COORDINATOR_VOUCHES,
  SUCCESSFUL_EVENTS_FOR_VERIFY,
  coordinatorEscrowExempt,
  coordinatorRequiresEscrowHold,
  coordinatorVouchThresholdMet,
  splitOrganizerPayoutCents,
} from '../lib/coordinator/escrow'
import {
  coordinatorCanVouchForCoordinator,
  vendorCanVouchForCoordinator,
} from '../lib/coordinator/vouch'
import { computeBoothCheckoutBreakdown } from '../lib/monetization/booth-checkout'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const defaultFeeConfig = {
  mode: 'percent_plus_flat' as const,
  flatCents: 100,
  bps: 300,
}

function main() {
  assert(ESCROW_HOLD_PERCENT === 75, 'hold percent is 75')
  assert(ESCROW_IMMEDIATE_PERCENT === 25, 'immediate percent is 25')
  assert(REQUIRED_VENDOR_VOUCHES === 10, 'required vendor vouches is 10')
  assert(REQUIRED_COORDINATOR_VOUCHES === 3, 'required coordinator vouches is 3')
  assert(SUCCESSFUL_EVENTS_FOR_VERIFY === 2, 'successful events threshold is 2')

  const split = splitOrganizerPayoutCents(10_000)
  assert(split.immediateCents === 2_500, '25% immediate on $100 payout')
  assert(split.heldCents === 7_500, '75% held on $100 payout')
  assert(split.immediateCents + split.heldCents === 10_000, 'split sums to payout')

  const verifiedAbsorbed = computeBoothCheckoutBreakdown({
    baseBoothCents: 10_000,
    feeConfig: defaultFeeConfig,
    passFeesToVendor: false,
    coordinatorIsVerified: true,
  })
  assert(verifiedAbsorbed.totalChargedCents === 10_000, 'verified absorbed charges base')
  assert(verifiedAbsorbed.platformFeeCents === 400, 'verified absorbed platform fee on $100')
  assert(verifiedAbsorbed.squareAppFeeCents === 400, 'verified absorbed app fee')

  const verifiedPassThrough = computeBoothCheckoutBreakdown({
    baseBoothCents: 10_000,
    feeConfig: defaultFeeConfig,
    passFeesToVendor: true,
    coordinatorIsVerified: true,
  })
  assert(verifiedPassThrough.totalChargedCents === 10_413, 'verified pass-through gross-up')
  assert(verifiedPassThrough.platformFeeCents === 413, 'pass-through fee delta')
  assert(verifiedPassThrough.squareAppFeeCents === 413, 'verified pass-through app fee only')

  const unverifiedPassThrough = computeBoothCheckoutBreakdown({
    baseBoothCents: 10_000,
    feeConfig: defaultFeeConfig,
    passFeesToVendor: true,
    coordinatorIsVerified: false,
  })
  assert(unverifiedPassThrough.escrowHoldCents === 7_500, 'unverified escrow on base')
  assert(
    unverifiedPassThrough.squareAppFeeCents === 7_913,
    'pass-through app fee includes escrow hold'
  )
  assert(
    unverifiedPassThrough.totalChargedCents - unverifiedPassThrough.squareAppFeeCents === 2_500,
    'coordinator immediate net is 25% of base with pass-through'
  )

  const unverifiedAbsorbed = computeBoothCheckoutBreakdown({
    baseBoothCents: 10_000,
    feeConfig: defaultFeeConfig,
    passFeesToVendor: false,
    coordinatorIsVerified: false,
  })
  assert(unverifiedAbsorbed.squareAppFeeCents === 7_900, 'absorbed app fee is platform fee + escrow')
  assert(
    unverifiedAbsorbed.totalChargedCents - unverifiedAbsorbed.squareAppFeeCents === 2_100,
    'coordinator immediate net is 25% minus platform fee when absorbed'
  )

  const eligible = vendorCanVouchForCoordinator({
    risk_score: 10,
    verification_status: 'verified',
    account_status: 'active',
  })
  assert(eligible.ok, 'low-risk verified vendor can vouch')

  const blocked = vendorCanVouchForCoordinator({
    risk_score: 30,
    verification_status: 'verified',
    account_status: 'active',
  })
  assert(!blocked.ok, 'high-risk vendor cannot vouch')

  const peerEligible = coordinatorCanVouchForCoordinator({
    role: 'coordinator',
    coordinator_is_verified: true,
    coordinator_account_status: 'active',
  })
  assert(peerEligible.ok, 'community-verified coordinator can peer vouch')

  const peerBlocked = coordinatorCanVouchForCoordinator({
    role: 'coordinator',
    coordinator_is_verified: false,
    coordinator_account_status: 'active',
  })
  assert(!peerBlocked.ok, 'unverified coordinator cannot peer vouch')

  const squareOnly = {
    coordinator_verification_status: 'unverified' as const,
    square_access_token: 'token',
    payout_onboarding_status: 'complete' as const,
  }
  assert(coordinatorRequiresEscrowHold(squareOnly, { vendorVouchCount: 0, coordinatorVouchCount: 0 }), 'Square-only organizer requires escrow')

  assert(
    coordinatorEscrowExempt(squareOnly, { vendorVouchCount: REQUIRED_VENDOR_VOUCHES, coordinatorVouchCount: 0 }),
    'ten vendor vouches exempt escrow'
  )
  assert(
    coordinatorEscrowExempt(squareOnly, { vendorVouchCount: 0, coordinatorVouchCount: REQUIRED_COORDINATOR_VOUCHES }),
    'three coordinator vouches exempt escrow'
  )
  assert(
    coordinatorEscrowExempt({ coordinator_is_verified: true }, { vendorVouchCount: 0, coordinatorVouchCount: 0 }),
    'community verified flag exempts escrow'
  )
  assert(
    !coordinatorEscrowExempt(
      { coordinator_verification_status: 'verified', coordinator_business_number: '123456789' },
      { vendorVouchCount: 0, coordinatorVouchCount: 0 }
    ),
    'business number alone no longer exempts escrow'
  )
  assert(
    coordinatorRequiresEscrowHold({}, { vendorVouchCount: 9, coordinatorVouchCount: 2 }),
    'nine vendor and two coordinator vouches still requires escrow'
  )
  assert(
    coordinatorVouchThresholdMet({ vendorVouchCount: 10, coordinatorVouchCount: 0 }),
    'vendor threshold met at 10'
  )
  assert(
    coordinatorVouchThresholdMet({ vendorVouchCount: 2, coordinatorVouchCount: 3 }),
    'coordinator threshold met at 3'
  )
  assert(
    !coordinatorVouchThresholdMet({ vendorVouchCount: 5, coordinatorVouchCount: 2 }),
    'mixed partial counts do not verify'
  )

  console.log('verify-coordinator-escrow: PASS')
}

main()
