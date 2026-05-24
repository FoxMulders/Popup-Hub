import type { Profile } from '@/types/database'

export const FREE_TIER_FEATURED_PRODUCT_LIMIT = 3

export type PremiumProfileSource = Pick<Profile, 'is_beta_tester'> | null | undefined

/** Beta testers receive full premium-tier bypass regardless of subscription state. */
export function hasPremiumAccess(profile: PremiumProfileSource): boolean {
  return profile?.is_beta_tester === true
}

export function featuredProductLimit(profile: PremiumProfileSource): number {
  return hasPremiumAccess(profile) ? Number.POSITIVE_INFINITY : FREE_TIER_FEATURED_PRODUCT_LIMIT
}

export function canAddFeaturedProduct(
  profile: PremiumProfileSource,
  currentFeaturedCount: number
): boolean {
  return currentFeaturedCount < featuredProductLimit(profile)
}

export function hasPriorityQueueAccess(profile: PremiumProfileSource): boolean {
  return hasPremiumAccess(profile)
}

export function hasFeaturedMapPlacement(profile: PremiumProfileSource): boolean {
  return hasPremiumAccess(profile)
}
