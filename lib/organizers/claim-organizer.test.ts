import assert from 'node:assert/strict'

/** Mirrors the PostgREST guard used when claiming an organizer profile. */
function claimUpdateGuard(userId: string): string {
  return `claimed_by.is.null,claimed_by.eq.${userId}`
}

assert.equal(
  claimUpdateGuard('user-a'),
  'claimed_by.is.null,claimed_by.eq.user-a',
  'claim update only applies when unclaimed or already held by the same user'
)

console.log('claim-organizer: ok')
