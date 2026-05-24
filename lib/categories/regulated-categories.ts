import type { Category } from '@/types/database'

/**
 * Health/safety-regulated categories — vendors must upload permits/documentation when applying.
 * Uses exact name match so "Artist" is not treated the same as "Tattoo Artist" / "Piercing Artist".
 */
export const REGULATED_CATEGORY_NAMES = [
  'Food (Truck)',
  'Beverage (Truck)',
  'Piercing Artist',
  'Tattoo Artist',
  'Alcohol',
  'Food & Beverage',
] as const

/** General vendor categories tracked in the system but with no default permit requirement. */
export const GENERAL_VENDOR_CATEGORY_NAMES = ['Artist', 'Author'] as const

export function categoryRequiresDocumentation(
  category: Pick<Category, 'name' | 'requires_documentation'> | null | undefined,
): boolean {
  if (!category) return false
  if (category.requires_documentation) return true
  return REGULATED_CATEGORY_NAMES.includes(
    category.name as (typeof REGULATED_CATEGORY_NAMES)[number],
  )
}

export function isGeneralVendorCategory(
  category: Pick<Category, 'name'> | null | undefined,
): boolean {
  if (!category) return false
  return GENERAL_VENDOR_CATEGORY_NAMES.includes(
    category.name as (typeof GENERAL_VENDOR_CATEGORY_NAMES)[number],
  )
}

export function categoryIdRequiresDocumentation(
  categoryId: string,
  categoriesById: Record<string, Pick<Category, 'name' | 'requires_documentation'>>,
): boolean {
  return categoryRequiresDocumentation(categoriesById[categoryId])
}
