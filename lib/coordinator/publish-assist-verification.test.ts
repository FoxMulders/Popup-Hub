import assert from 'node:assert/strict'
import {
  coordinatorHardPublishBlockReason,
  coordinatorPublishBlockReason,
} from '@/lib/coordinator/verification'

const unverifiedOffline = {
  coordinator_verification_status: 'unverified' as const,
  coordinator_organization_name: null,
  coordinator_business_number: null,
  coordinator_risk_score: 0,
  coordinator_account_status: 'active' as const,
  stripe_onboarding_complete: false,
  square_access_token: null,
  payout_onboarding_status: 'not_started' as const,
  has_square_event: false,
}

assert.equal(
  coordinatorPublishBlockReason(unverifiedOffline),
  'Connect Stripe or Square, or submit your organization name before publishing.'
)
assert.equal(coordinatorHardPublishBlockReason(unverifiedOffline), null)

const suspended = {
  ...unverifiedOffline,
  coordinator_organization_name: 'Community Market Co',
}
assert.notEqual(coordinatorPublishBlockReason({ ...suspended, coordinator_account_status: 'suspended' }), null)
assert.notEqual(coordinatorHardPublishBlockReason({ ...suspended, coordinator_account_status: 'suspended' }), null)

const offlinePending = {
  ...unverifiedOffline,
  coordinator_organization_name: 'Hope Holly Markets',
}
assert.equal(coordinatorPublishBlockReason(offlinePending), null)
assert.equal(coordinatorHardPublishBlockReason(offlinePending), null)

console.log('publish-assist-verification: ok')
