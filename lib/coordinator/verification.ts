import { validateBusinessNumber } from '@/lib/vendor/verification'
import { RISK_SCORE_BLOCK_THRESHOLD } from '@/lib/vendor/verification'
import type { CoordinatorAccountStatus, CoordinatorVerificationStatus, PayoutOnboardingStatus } from '@/types/database'

export { RISK_SCORE_BLOCK_THRESHOLD as COORDINATOR_RISK_SCORE_BLOCK_THRESHOLD }

export type CoordinatorVerificationInput = {
  coordinator_organization_name?: string | null
  coordinator_business_number?: string | null
  coordinator_verification_status?: CoordinatorVerificationStatus
  coordinator_risk_score?: number | null
}

export type CoordinatorFraudGate = {
  coordinator_verification_status?: CoordinatorVerificationStatus | null
  coordinator_organization_name?: string | null
  coordinator_business_number?: string | null
  coordinator_risk_score?: number | null
  coordinator_account_status?: CoordinatorAccountStatus | null
  stripe_onboarding_complete?: boolean | null
  square_access_token?: string | null
  payout_onboarding_status?: PayoutOnboardingStatus | null
  payout_account_id?: string | null
}

/** Square OAuth is stored on the coordinator profile and applies to all markets. */
export function isSquareConnectedCoordinator(profile: CoordinatorFraudGate | null | undefined): boolean {
  if (!profile) return false
  return (
    (!!profile.square_access_token && profile.payout_onboarding_status === 'complete') ||
    (!!profile.payout_account_id && profile.payout_onboarding_status === 'complete')
  )
}

export function hasOfflineOrganizerProfile(profile: CoordinatorFraudGate | null | undefined): boolean {
  if (!profile) return false
  const org = profile.coordinator_organization_name?.trim() ?? ''
  return org.length >= 2
}

/** Admin-verified status plus a valid business registration / tax ID. */
export function hasVerifiedBusinessTaxId(profile: CoordinatorFraudGate | null | undefined): boolean {
  if (!profile) return false
  if (profile.coordinator_verification_status !== 'verified') return false
  return validateBusinessNumber(profile.coordinator_business_number).ok
}

export function coordinatorIsAdminVerified(profile: CoordinatorFraudGate | null | undefined): boolean {
  return profile?.coordinator_verification_status === 'verified'
}

/** Stripe, Square, or admin-verified — required for card/digital payment collection. */
export function coordinatorHasPaymentTrustPath(profile: CoordinatorFraudGate | null | undefined): boolean {
  if (!profile) return false
  return (
    coordinatorIsAdminVerified(profile) ||
    profile.stripe_onboarding_complete === true ||
    isSquareConnectedCoordinator(profile)
  )
}

/** Any trust path including offline org + business number submission. */
export function coordinatorHasPublishTrustPath(profile: CoordinatorFraudGate | null | undefined): boolean {
  if (!profile) return false
  return coordinatorHasPaymentTrustPath(profile) || hasOfflineOrganizerProfile(profile)
}

export function isHighRiskCoordinator(profile: CoordinatorFraudGate | null | undefined): boolean {
  return (profile?.coordinator_risk_score ?? 0) > RISK_SCORE_BLOCK_THRESHOLD
}

export function isCoordinatorAccountBlocked(profile: CoordinatorFraudGate | null | undefined): boolean {
  const status = profile?.coordinator_account_status ?? 'active'
  return status === 'suspended' || status === 'banned'
}

export function coordinatorPublishBlockReason(
  profile: CoordinatorFraudGate | null | undefined
): string | null {
  if (!profile) {
    return 'Organizer profile not found.'
  }
  if (isCoordinatorAccountBlocked(profile)) {
    return 'Your organizer account is suspended. Contact support to resolve verification issues.'
  }
  if (profile.coordinator_verification_status === 'rejected') {
    return 'Organizer verification was rejected. Update your business details or contact support.'
  }
  if (isHighRiskCoordinator(profile)) {
    return 'Your organizer account requires additional verification before publishing markets.'
  }
  if (coordinatorHasPublishTrustPath(profile)) {
    return null
  }
  return 'Connect Stripe or Square, or submit your organization name before publishing.'
}

export function coordinatorPaymentCollectionBlockReason(
  profile: CoordinatorFraudGate | null | undefined
): string | null {
  if (!profile) {
    return 'Organizer profile not found.'
  }
  if (isCoordinatorAccountBlocked(profile)) {
    return 'This market organizer cannot collect payments — account suspended.'
  }
  if (profile.coordinator_verification_status === 'rejected') {
    return 'This market organizer cannot collect payments — verification rejected.'
  }
  if (isHighRiskCoordinator(profile)) {
    return 'This market organizer cannot collect payments until verification is complete.'
  }
  if (coordinatorHasPaymentTrustPath(profile)) {
    return null
  }
  if (hasOfflineOrganizerProfile(profile)) {
    return 'Offline payment collection is pending admin verification for this organizer.'
  }
  return 'This market organizer has not completed payment verification.'
}

export function coordinatorVendorApplyBlockReason(
  profile: CoordinatorFraudGate | null | undefined
): string | null {
  if (!profile) return null
  if (isCoordinatorAccountBlocked(profile)) {
    return 'This market is not accepting applications — the organizer account is suspended.'
  }
  return null
}

export function computeCoordinatorRiskScore(input: CoordinatorVerificationInput): number {
  let score = 0

  const org = input.coordinator_organization_name?.trim() ?? ''
  const bnInput = input.coordinator_business_number?.trim() ?? ''
  const bn = bnInput ? validateBusinessNumber(bnInput) : { ok: true, normalized: null as string | null }

  if (org.length < 2) score += 25
  if (bnInput && !bn.ok) score += 35

  if (input.coordinator_verification_status === 'rejected') score += 50
  if (input.coordinator_verification_status === 'verified') {
    score = Math.max(0, score - 30)
  }

  return Math.min(100, Math.max(0, score))
}

const AUTO_VERIFY_RISK_THRESHOLD = 25

export async function evaluateCoordinatorVerification(input: CoordinatorVerificationInput): Promise<{
  coordinator_risk_score: number
  coordinator_verification_status: CoordinatorVerificationStatus
  coordinator_organization_name: string | null
  coordinator_business_number: string | null
}> {
  const org = input.coordinator_organization_name?.trim() ?? ''
  const bnInput = input.coordinator_business_number?.trim() ?? ''
  const bn = bnInput ? validateBusinessNumber(bnInput) : { ok: true, normalized: null as string | null }

  const risk = computeCoordinatorRiskScore({
    ...input,
    coordinator_organization_name: org || null,
    coordinator_business_number: bn.normalized,
  })

  let coordinator_verification_status: CoordinatorVerificationStatus =
    input.coordinator_verification_status ?? 'unverified'

  if (input.coordinator_verification_status === 'verified') {
    coordinator_verification_status = 'verified'
  } else if (org.length >= 2 && bnInput && bn.ok) {
    coordinator_verification_status =
      risk <= AUTO_VERIFY_RISK_THRESHOLD ? 'verified' : 'pending'
  } else if (org.length >= 2) {
    coordinator_verification_status = 'pending'
  }

  return {
    coordinator_risk_score: risk,
    coordinator_verification_status,
    coordinator_organization_name: org || null,
    coordinator_business_number: bn.normalized,
  }
}

export const COORDINATOR_FRAUD_PROFILE_SELECT =
  'coordinator_verification_status, coordinator_organization_name, coordinator_business_number, coordinator_risk_score, coordinator_account_status, stripe_onboarding_complete, square_access_token, payout_onboarding_status, payout_account_id'
