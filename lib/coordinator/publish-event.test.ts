import assert from 'node:assert/strict'
import { coordinatorPublishBlockReason } from '@/lib/coordinator/verification'
import { resolvePublishGateBlockReason } from '@/lib/coordinator/publish-event'

const blockedOrganizer = {
  coordinator_verification_status: 'unverified' as const,
  coordinator_organization_name: null,
  coordinator_business_number: null,
  coordinator_risk_score: 0,
  coordinator_account_status: 'active' as const,
  stripe_onboarding_complete: false,
  square_access_token: null,
  payout_onboarding_status: null,
  has_square_event: false,
}

const gateReason = coordinatorPublishBlockReason(blockedOrganizer)
assert.ok(gateReason, 'organizer without trust path should be blocked from publishing')

const enforced = resolvePublishGateBlockReason(blockedOrganizer)
assert.equal(enforced, gateReason)

const bypassed = resolvePublishGateBlockReason(blockedOrganizer, { bypassPublishGate: true })
assert.equal(bypassed, null, 'admin publish-assist approval must bypass organizer trust-path gate')

console.log('publish-event: ok')
