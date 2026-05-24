import type { EventListingType } from '@/types/database'

export function isQuarterAuctionListing(
  listingType: EventListingType | null | undefined
): boolean {
  return (listingType ?? 'community_market') === 'garage_yard_sale'
}

/** Quarter auctions must always be single-day events. */
export function effectiveScheduleTypeForListing(
  listingType: EventListingType | null | undefined,
  scheduleType: 'single' | 'multi'
): 'single' | 'multi' {
  return isQuarterAuctionListing(listingType) ? 'single' : scheduleType
}
