import { PASSPORT_MLM_BROAD_CATEGORY_NAME } from '@/lib/vendor/passport-categories'

/** Sort category records A→Z by display name. */
export function sortCategoriesByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name))
}

export function compareCategoryNames(a: string, b: string): number {
  return a.localeCompare(b)
}

/** Coordinator MLM lists: pin the broad parent category first, then A→Z. */
export function compareCategoryNamesWithMlmBroadFirst(a: string, b: string): number {
  const aIsBroad = a === PASSPORT_MLM_BROAD_CATEGORY_NAME
  const bIsBroad = b === PASSPORT_MLM_BROAD_CATEGORY_NAME
  if (aIsBroad && !bIsBroad) return -1
  if (!aIsBroad && bIsBroad) return 1
  return compareCategoryNames(a, b)
}
