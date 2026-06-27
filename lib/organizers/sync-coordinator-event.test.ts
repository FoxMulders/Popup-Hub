import assert from 'node:assert/strict'
import { canAutoClaimOrganizerOnPublish } from '@/lib/organizers/sync-coordinator-event'

const coordinatorId = 'coord-111'

assert.equal(
  canAutoClaimOrganizerOnPublish(
    { claimed_by: coordinatorId, popup_hub_coordinator_id: null },
    coordinatorId
  ),
  true,
  'already claimed by coordinator'
)

assert.equal(
  canAutoClaimOrganizerOnPublish(
    { claimed_by: null, popup_hub_coordinator_id: coordinatorId },
    coordinatorId
  ),
  true,
  'linked via popup_hub_coordinator_id'
)

assert.equal(
  canAutoClaimOrganizerOnPublish(
    { claimed_by: null, popup_hub_coordinator_id: null },
    coordinatorId
  ),
  false,
  'unclaimed HubGuard profile must not auto-claim on publish'
)

assert.equal(
  canAutoClaimOrganizerOnPublish(
    { claimed_by: 'other-user', popup_hub_coordinator_id: null },
    coordinatorId
  ),
  false,
  'profile claimed by someone else'
)

console.log('sync-coordinator-event: ok')
