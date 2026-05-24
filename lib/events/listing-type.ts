import type { EventListingType } from '@/types/database'

export function isQuarterAuctionListing(
  listingType: EventListingType | null | undefined
): boolean {
  return (listingType ?? 'community_market') === 'garage_yard_sale'
}
