import {
  normalizeFlyerDate,
  parseMultiDayDateSpan,
  resolveNextOccurrenceDate,
} from '@/lib/flyer/normalize'
import { resolveFlyerListingType } from '@/lib/flyer/listing-type'

const today = new Date('2026-06-08T12:00:00Z')
let failed = 0

function expect(label: string, actual: string | null, expected: string | null) {
  if (actual !== expected) {
    failed += 1
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`)
    return
  }
  console.log(`OK ${label}`)
}

expect('October 5 next occurrence', normalizeFlyerDate('October 5', today), '2026-10-05')
expect('March 15 rolls to next year', normalizeFlyerDate('March 15', today), '2027-03-15')
expect('wrong past year 2006-10-05', normalizeFlyerDate('2006-10-05', today), '2026-10-05')
expect('stale year 2024-03-15', normalizeFlyerDate('2024-03-15', today), '2027-03-15')
expect(
  'resolveNextOccurrence Oct 5',
  resolveNextOccurrenceDate(10, 5, today),
  '2026-10-05'
)

const span = parseMultiDayDateSpan('Oct 5-6', today)
expect('multi-day start', span?.startDate ?? null, '2026-10-05')
expect('multi-day end', span?.endDate ?? null, '2026-10-06')

expect(
  'listing_type quarter_auction',
  resolveFlyerListingType({ listingType: 'quarter_auction' }),
  'garage_yard_sale'
)
expect(
  'live auction text fallback',
  resolveFlyerListingType({ combinedText: 'Annual Live Auction fundraiser' }),
  'garage_yard_sale'
)
expect(
  'community market explicit',
  resolveFlyerListingType({ listingType: 'community_market' }),
  'community_market'
)

process.exit(failed > 0 ? 1 : 0)
