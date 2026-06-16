import type { Category } from '@/types/database'
import { isMlmCategory } from '@/lib/categories/mlm-constraints'

export const PASSPORT_MLM_BROAD_CATEGORY_NAME = 'Multi Level Marketer (MLM)'

/** Broad primary category vendors pick when they sell via MLM / direct sales. */
export function isPassportMlmBroadCategory(
  category: Pick<Category, 'name' | 'is_broad' | 'is_mlm'> | null | undefined
): boolean {
  if (!category || category.is_broad !== true) return false
  return category.name === PASSPORT_MLM_BROAD_CATEGORY_NAME || category.is_mlm === true
}

/** Niche tags shown in passport step 1 — MLM brand tags only when primary is MLM broad. */
export function filterPassportNicheCategories(
  categories: Category[],
  primaryCategory: Pick<Category, 'name' | 'is_broad' | 'is_mlm'> | null | undefined
): Category[] {
  const showMlmTags = isPassportMlmBroadCategory(primaryCategory)
  return categories.filter((cat) => {
    if (!isMlmCategory(cat)) return true
    return showMlmTags
  })
}

export function stripMlmNicheCategoryIds(categoryIds: string[], categories: Category[]): string[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  return categoryIds.filter((id) => {
    const cat = byId.get(id)
    if (!cat) return true
    return !isMlmCategory(cat)
  })
}

export function resolvePassportCategoryIds(passport: {
  category_ids?: string[] | null
  primary_category_id?: string | null
}): string[] {
  if (passport.category_ids?.length) return passport.category_ids
  if (passport.primary_category_id) return [passport.primary_category_id]
  return []
}

export function categoryNamesForIds(
  ids: string[],
  categories: { id: string; name: string }[]
): string[] {
  const byId = new Map(categories.map((c) => [c.id, c.name]))
  return ids.map((id) => byId.get(id)).filter((name): name is string => Boolean(name))
}

export function toggleCategoryId(selected: string[], categoryId: string): string[] {
  return selected.includes(categoryId)
    ? selected.filter((id) => id !== categoryId)
    : [...selected, categoryId]
}
