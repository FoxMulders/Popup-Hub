import type { EventListingType } from '@/types/database'
import { z } from 'zod'

/** Values returned by the flyer vision model. */
export const parsedFlyerListingTypeSchema = z.enum(['community_market', 'quarter_auction'])

export type ParsedFlyerListingType = z.infer<typeof parsedFlyerListingTypeSchema>

const QUARTER_AUCTION_TEXT_RE =
  /\b(quarter\s*auction|live\s*auction|quarter\s*sale)\b/i

export function flyerTextSuggestsQuarterAuction(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  return QUARTER_AUCTION_TEXT_RE.test(text)
}

/** Normalize model output (and legacy aliases) onto wizard listing types. */
export function resolveFlyerListingType(input: {
  listingType?: string | null
  combinedText?: string | null
}): EventListingType | null {
  const raw = input.listingType?.trim().toLowerCase()
  if (raw === 'quarter_auction' || raw === 'garage_yard_sale') {
    return 'garage_yard_sale'
  }
  if (raw === 'community_market') {
    return 'community_market'
  }

  if (flyerTextSuggestsQuarterAuction(input.combinedText ?? '')) {
    return 'garage_yard_sale'
  }

  return null
}
