import type { CoordinatorFraudGate } from '@/lib/coordinator/verification'

/** Fraction of organizer payout held until post-event release for unverified coordinators. */
export const ESCROW_HOLD_PERCENT = 75

/** Fraction released immediately to cover venue deposits. */
export const ESCROW_IMMEDIATE_PERCENT = 25

export const REQUIRED_VENDOR_VOUCHES = 10

export const REQUIRED_COORDINATOR_VOUCHES = 3

/** @deprecated Use REQUIRED_VENDOR_VOUCHES */
export const REQUIRED_VOUCHES = REQUIRED_VENDOR_VOUCHES

export const SUCCESSFUL_EVENTS_FOR_VERIFY = 2

export const ESCROW_RELEASE_HOURS_AFTER_EVENT = 24

export type EscrowSettlementMode = 'wallet' | 'external_processor'

export type EscrowHoldStatus = 'held' | 'released' | 'blocked'

export type CoordinatorVouchCounts = {
  vendorVouchCount: number
  coordinatorVouchCount: number
}

export function splitOrganizerPayoutCents(organizerPayoutCents: number): {
  immediateCents: number
  heldCents: number
} {
  if (organizerPayoutCents <= 0) {
    return { immediateCents: 0, heldCents: 0 }
  }

  const immediateCents = Math.floor((organizerPayoutCents * ESCROW_IMMEDIATE_PERCENT) / 100)
  const heldCents = organizerPayoutCents - immediateCents
  return { immediateCents, heldCents }
}

export function computeEscrowEligibleReleaseAt(eventEndAt: string | Date): string {
  const end = typeof eventEndAt === 'string' ? new Date(eventEndAt) : eventEndAt
  const releaseAt = new Date(end.getTime() + ESCROW_RELEASE_HOURS_AFTER_EVENT * 60 * 60 * 1000)
  return releaseAt.toISOString()
}

export type CoordinatorEscrowProfile = CoordinatorFraudGate & {
  coordinator_is_verified?: boolean | null
  coordinator_successful_events_count?: number | null
}

export function coordinatorVouchThresholdMet(counts: CoordinatorVouchCounts): boolean {
  return (
    counts.vendorVouchCount >= REQUIRED_VENDOR_VOUCHES ||
    counts.coordinatorVouchCount >= REQUIRED_COORDINATOR_VOUCHES
  )
}

export function coordinatorEscrowExempt(
  profile: CoordinatorEscrowProfile | null | undefined,
  counts: CoordinatorVouchCounts | number
): boolean {
  const vouchCounts: CoordinatorVouchCounts =
    typeof counts === 'number'
      ? { vendorVouchCount: counts, coordinatorVouchCount: 0 }
      : counts

  if (profile?.coordinator_is_verified === true) return true
  if (coordinatorVouchThresholdMet(vouchCounts)) return true
  return false
}

export function coordinatorRequiresEscrowHold(
  profile: CoordinatorEscrowProfile | null | undefined,
  counts: CoordinatorVouchCounts | number
): boolean {
  return !coordinatorEscrowExempt(profile, counts)
}
