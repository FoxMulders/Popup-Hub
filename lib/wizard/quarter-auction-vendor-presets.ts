import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'
import { classifyCategoryBucket } from '@/lib/categories/category-buckets'
import type { Category } from '@/types/database'

/** Default vendor spots per broad category for a typical quarter auction night. */
const DEFAULT_SPOTS_BY_BUCKET: Record<
  ReturnType<typeof classifyCategoryBucket>,
  number
> = {
  food: 10,
  makers: 12,
  art: 8,
  apparel: 8,
  commercial: 4,
}

/**
 * Pre-fill broad vendor categories with sensible spot counts for quarter auctions.
 * Mirrors market "Apply suggested caps" — no floor plan required.
 */
export function buildQuarterAuctionVendorPreset(
  categories: Category[],
  allowMlm: boolean
): CategoryLimit[] {
  const broad = categories.filter(
    (c) => c.is_broad === true && (allowMlm || !c.is_mlm)
  )

  return broad.map((cat) => ({
    categoryId: cat.id,
    categoryName: cat.name,
    maxSlots: DEFAULT_SPOTS_BY_BUCKET[classifyCategoryBucket(cat, allowMlm)],
    pricePerBooth: 0,
  }))
}

/**
 * Distribute a target headcount evenly across broad categories (minimum 1 each).
 */
export function distributeQuarterAuctionTotalSpots(
  categories: Category[],
  totalSpots: number,
  allowMlm: boolean
): CategoryLimit[] {
  const broad = categories.filter(
    (c) => c.is_broad === true && (allowMlm || !c.is_mlm)
  )
  if (broad.length === 0 || totalSpots <= 0) return []

  const base = Math.max(1, Math.floor(totalSpots / broad.length))
  let remainder = totalSpots - base * broad.length

  return broad.map((cat) => {
    const extra = remainder > 0 ? 1 : 0
    if (extra) remainder -= 1
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      maxSlots: base + extra,
      pricePerBooth: 0,
    }
  })
}
