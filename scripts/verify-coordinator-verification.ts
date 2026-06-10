/**
 * Coordinator verification trust paths and block reasons.
 *
 * Run: npx tsx scripts/verify-coordinator-verification.ts
 */

import {
  coordinatorPaymentCollectionBlockReason,
  coordinatorPublishBlockReason,
  coordinatorVendorApplyBlockReason,
  evaluateCoordinatorVerification,
  hasOfflineOrganizerProfile,
  hasVerifiedBusinessTaxId,
  isSquareConnectedCoordinator,
} from '../lib/coordinator/verification'
import { coordinatorEscrowExempt, coordinatorRequiresEscrowHold } from '../lib/coordinator/escrow'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

async function main() {
  const stripeTrusted = {
    coordinator_verification_status: 'unverified' as const,
    stripe_onboarding_complete: true,
    coordinator_account_status: 'active' as const,
    coordinator_risk_score: 0,
  }
  assert(coordinatorPublishBlockReason(stripeTrusted) === null, 'Stripe should unlock publish')
  assert(
    coordinatorPaymentCollectionBlockReason(stripeTrusted) === null,
    'Stripe should unlock payment collection'
  )

  const squareTrusted = {
    coordinator_verification_status: 'unverified' as const,
    square_access_token: 'token',
    payout_onboarding_status: 'complete' as const,
    coordinator_account_status: 'active' as const,
    coordinator_risk_score: 0,
  }
  assert(isSquareConnectedCoordinator(squareTrusted), 'Square connected detected')
  assert(coordinatorPublishBlockReason(squareTrusted) === null, 'Square should unlock publish')

  const offlinePending = {
    coordinator_verification_status: 'pending' as const,
    coordinator_organization_name: 'Calgary Makers Market',
    coordinator_business_number: '123456789',
    coordinator_risk_score: 40,
    coordinator_account_status: 'active' as const,
  }
  assert(hasOfflineOrganizerProfile(offlinePending), 'offline profile detected')
  assert(coordinatorPublishBlockReason(offlinePending) === null, 'offline pending can publish')
  assert(
    coordinatorPaymentCollectionBlockReason(offlinePending) !== null,
    'offline pending cannot collect payments'
  )

  const offlineOrgOnly = {
    coordinator_verification_status: 'pending' as const,
    coordinator_organization_name: 'Calgary Makers Market',
    coordinator_business_number: null,
    coordinator_risk_score: 40,
    coordinator_account_status: 'active' as const,
  }
  assert(hasOfflineOrganizerProfile(offlineOrgOnly), 'org-only offline profile can publish')
  assert(!hasVerifiedBusinessTaxId(offlineOrgOnly), 'org-only is not verified tax id')
  assert(coordinatorRequiresEscrowHold(offlineOrgOnly, 0), 'org-only without vouches requires escrow')

  const taxVerified = {
    coordinator_verification_status: 'verified' as const,
    coordinator_business_number: '123456789',
    coordinator_account_status: 'active' as const,
  }
  assert(hasVerifiedBusinessTaxId(taxVerified), 'verified tax id detected')
  assert(!coordinatorRequiresEscrowHold(taxVerified, 0), 'verified tax id exempts escrow')

  const suspended = {
    coordinator_verification_status: 'verified' as const,
    coordinator_account_status: 'suspended' as const,
    coordinator_risk_score: 0,
  }
  assert(coordinatorPublishBlockReason(suspended) !== null, 'suspended blocks publish')
  assert(
    coordinatorVendorApplyBlockReason(suspended) !== null,
    'suspended blocks vendor apply'
  )

  const evaluated = await evaluateCoordinatorVerification({
    coordinator_organization_name: 'Test Market Co',
    coordinator_business_number: '123456789',
  })
  assert(evaluated.coordinator_verification_status === 'verified', 'low risk auto-verifies')
  assert(evaluated.coordinator_risk_score <= 25, 'low risk score')

  const orgOnly = await evaluateCoordinatorVerification({
    coordinator_organization_name: 'Test Market Co',
  })
  assert(orgOnly.coordinator_verification_status === 'pending', 'org-only stays pending')
  assert(orgOnly.coordinator_business_number === null, 'org-only stores no business number')

  assert(
    coordinatorEscrowExempt({ coordinator_is_verified: true }, 0),
    'admin community verified exempts escrow'
  )

  console.log('verify-coordinator-verification: PASS')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
