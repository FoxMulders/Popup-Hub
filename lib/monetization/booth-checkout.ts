import type { PlatformFeeMode } from '@/types/database'
import { computePlatformFeeCents } from '@/lib/monetization/fees'
import type { EventFeeConfig } from '@/lib/monetization/fee-config'
import {
  ESCROW_HOLD_PERCENT,
  splitOrganizerPayoutCents,
} from '@/lib/coordinator/escrow-policy'

export type BoothCheckoutBreakdown = {
  baseBoothCents: number
  totalChargedCents: number
  platformFeeCents: number
  passThroughFeeCents: number
  passFeesToVendor: boolean
  coordinatorIsVerified: boolean
  escrowHoldCents: number
  coordinatorImmediateCents: number
  squareAppFeeCents: number
  organizerPayoutCents: number
}

function grossUpTotalCents(baseBoothCents: number, feeConfig: EventFeeConfig): number {
  const { flatCents, bps } = feeConfig
  if (bps <= 0) {
    return baseBoothCents + flatCents
  }
  return Math.ceil((baseBoothCents + flatCents) / (1 - bps / 10000))
}

export function canPassFeesToVendor(feeConfig: EventFeeConfig): boolean {
  return feeConfig.mode === 'percent_plus_flat'
}

export function computeBoothCheckoutBreakdown(params: {
  baseBoothCents: number
  feeConfig: EventFeeConfig
  passFeesToVendor: boolean
  coordinatorIsVerified: boolean
}): BoothCheckoutBreakdown {
  const { baseBoothCents, feeConfig, coordinatorIsVerified } = params
  const passFeesToVendor = params.passFeesToVendor && canPassFeesToVendor(feeConfig)

  const platformFeeOnBase = computePlatformFeeCents(baseBoothCents, feeConfig)

  let totalChargedCents = baseBoothCents
  let passThroughFeeCents = 0
  let platformFeeCents = platformFeeOnBase

  if (passFeesToVendor) {
    totalChargedCents = grossUpTotalCents(baseBoothCents, feeConfig)
    passThroughFeeCents = totalChargedCents - baseBoothCents
    platformFeeCents = passThroughFeeCents
  }

  const organizerPayoutCents = baseBoothCents

  let escrowHoldCents = 0
  let coordinatorImmediateCents = organizerPayoutCents

  if (!coordinatorIsVerified) {
    const split = splitOrganizerPayoutCents(organizerPayoutCents)
    escrowHoldCents = split.heldCents
    coordinatorImmediateCents = split.immediateCents
  }

  let squareAppFeeCents = 0
  if (passFeesToVendor) {
    squareAppFeeCents = passThroughFeeCents + escrowHoldCents
  } else {
    squareAppFeeCents = platformFeeOnBase + escrowHoldCents
  }

  squareAppFeeCents = Math.min(squareAppFeeCents, totalChargedCents)

  return {
    baseBoothCents,
    totalChargedCents,
    platformFeeCents,
    passThroughFeeCents,
    passFeesToVendor,
    coordinatorIsVerified,
    escrowHoldCents,
    coordinatorImmediateCents,
    squareAppFeeCents,
    organizerPayoutCents,
  }
}

export function computeStripeApplicationFeeCents(breakdown: BoothCheckoutBreakdown): number {
  return breakdown.squareAppFeeCents
}

/** Escrow split base for ledger — always the coordinator asking price before pass-through. */
export function escrowBaseBoothCents(breakdown: BoothCheckoutBreakdown): number {
  return breakdown.baseBoothCents
}

export type { PlatformFeeMode }
