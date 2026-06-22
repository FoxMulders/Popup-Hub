/**
 * Discover quarter-auction listing filter smoke test.
 *
 * Run: npx tsx scripts/verify-discover-quarter-auctions.ts
 */

import { filterEventsByListingType } from '../lib/shopper/events'
import type { Event } from '../types/database'

let pass = 0
let fail = 0

function assert(cond: unknown, msg: string): void {
  if (cond) {
    console.log(`PASS - ${msg}`)
    pass++
  } else {
    console.log(`FAIL - ${msg}`)
    fail++
  }
}

const sampleEvents = [
  { id: 'market-1', listing_type: 'community_market' },
  { id: 'qa-1', listing_type: 'garage_yard_sale' },
  { id: 'market-2', listing_type: null },
] as Event[]

const community = filterEventsByListingType(sampleEvents, 'community_market')
assert(
  community.map((event) => event.id).join(',') === 'market-1,market-2',
  'Community discover scope excludes quarter auctions'
)

const quarter = filterEventsByListingType(sampleEvents, 'garage_yard_sale')
assert(quarter.map((event) => event.id).join(',') === 'qa-1', 'Quarter discover scope includes garage_yard_sale only')

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
