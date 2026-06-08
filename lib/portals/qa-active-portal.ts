import {
  portalFromAccessiblePath,
  resolveActivePortal,
} from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'

function assert(label: string, condition: boolean) {
  if (!condition) {
    throw new Error(`FAIL: ${label}`)
  }
  console.log(`OK: ${label}`)
}

const coordinatorProfile = { role: 'coordinator' } as Profile

assert(
  'coordinator route overrides vendor cookie in nav',
  resolveActivePortal('vendor', coordinatorProfile, '/coordinator/events/abc') === 'coordinator'
)

assert(
  'vendor route overrides coordinator cookie in nav',
  resolveActivePortal('coordinator', coordinatorProfile, '/vendor/dashboard') === 'vendor'
)

assert(
  'patron route keeps vendor cookie on discover',
  resolveActivePortal('vendor', coordinatorProfile, '/discover') === 'vendor'
)

assert(
  'coordinator path requires coordinator access',
  portalFromAccessiblePath('/coordinator/events/1', 'vendor') === null
)

assert(
  'vendor-only account cannot resolve coordinator from path',
  resolveActivePortal('vendor', { role: 'vendor' } as Profile, '/coordinator/dashboard') === 'vendor'
)

console.log('active-portal QA passed')
