/**
 * Run: npx tsx lib/pwa/coordinator-ops-offline.test.ts
 */
import {
  applyPendingMutationsToApplications,
  type PendingCoordinatorMutation,
} from './coordinator-ops-offline'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const apps = [
  { id: 'a1', checked_in: false, payment_status: 'unpaid' as const },
  { id: 'a2', checked_in: false, payment_status: 'unpaid' as const },
]

const checkInMutation = (
  applicationId: string,
  checked_in: boolean,
  clientTimestamp: number
): PendingCoordinatorMutation => ({
  id: `m-${applicationId}-${clientTimestamp}`,
  eventId: 'evt-1',
  type: 'check_in',
  payload: { applicationId, checked_in },
  clientTimestamp,
  attempts: 0,
})

console.log('coordinator-ops-offline tests')

const afterOne = applyPendingMutationsToApplications(apps, [
  checkInMutation('a1', true, 1),
])
assert(afterOne[0]?.checked_in === true, 'first vendor checked in')
assert(afterOne[1]?.checked_in === false, 'second vendor unchanged')

const afterToggle = applyPendingMutationsToApplications(apps, [
  checkInMutation('a1', true, 1),
  checkInMutation('a1', false, 2),
])
assert(afterToggle[0]?.checked_in === false, 'later undo wins for same vendor')

const afterPayment = applyPendingMutationsToApplications(apps, [
  {
    id: 'pay-1',
    eventId: 'evt-1',
    type: 'payment_status',
    payload: {
      applicationId: 'a2',
      updates: { payment_status: 'paid' },
    },
    clientTimestamp: 1,
    attempts: 0,
  },
])
assert(afterPayment[1]?.payment_status === 'paid', 'payment_status mutation applied')

console.log('All coordinator-ops-offline tests passed.')
