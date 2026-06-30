import assert from 'node:assert/strict'

/** Mirrors the PostgREST guard used when approving an organizer claim. */
function approveOrganizerClaimGuard(requestedBy: string): string {
  return `claimed_by.is.null,claimed_by.eq.${requestedBy}`
}

assert.equal(
  approveOrganizerClaimGuard('user-a'),
  'claimed_by.is.null,claimed_by.eq.user-a',
  'approve only when unclaimed or already held by the same requester'
)

console.log('claim-organizer: ok')
