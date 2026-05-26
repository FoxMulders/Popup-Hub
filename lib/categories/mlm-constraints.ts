import type { Category } from '@/types/database'
import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'

/** Known direct-sales brands — each is capped at one booth slot per event. */
export const SINGLE_SLOT_MLM_BRAND_NAMES = [
  '4Life',
  'Amway',
  'Arbonne',
  'Avon',
  'Color Street',
  'doTERRA',
  'Norwex',
] as const

export const DEFAULT_GLOBAL_MLM_CAP = 3

function normalizeBrandName(name: string): string {
  return name.trim().toLowerCase()
}

export function isSingleSlotMlmBrand(categoryName: string): boolean {
  const normalized = normalizeBrandName(categoryName)
  return SINGLE_SLOT_MLM_BRAND_NAMES.some(
    (brand) => normalized === normalizeBrandName(brand) || normalized.includes(normalizeBrandName(brand))
  )
}

export function isMlmCategory(category: Pick<Category, 'name' | 'is_mlm'>): boolean {
  return category.is_mlm || isSingleSlotMlmBrand(category.name)
}

export function isSingleSlotMlmLimit(
  limit: Pick<CategoryLimit, 'categoryName' | 'categoryId'>,
  categories: Category[]
): boolean {
  const cat = categories.find((c) => c.id === limit.categoryId)
  if (cat) return isMlmCategory(cat)
  return isSingleSlotMlmBrand(limit.categoryName)
}

export function clampMlmMaxSlots(
  categoryName: string,
  category: Pick<Category, 'name' | 'is_mlm'> | undefined,
  slots: number
): number {
  const isMlm = category ? isMlmCategory(category) : isSingleSlotMlmBrand(categoryName)
  if (isMlm) return 1
  return Math.max(1, slots)
}

export function countActiveMlmSlots(limits: CategoryLimit[], categories: Category[]): number {
  const byId = new Map(categories.map((c) => [c.id, c]))
  return limits.reduce((sum, limit) => {
    const cat = byId.get(limit.categoryId)
    const isMlm = cat ? isMlmCategory(cat) : isSingleSlotMlmBrand(limit.categoryName)
    return isMlm ? sum + limit.maxSlots : sum
  }, 0)
}

/**
 * Apply per-brand (max 1 booth slot each) MLM rules.
 *
 * The collective `globalMlmCap` is enforced at approval time (see
 * `lib/applications/mlm-approval-cap.ts`), NOT at config time — coordinators can
 * list every MLM brand they want to consider; the cap controls how many actually
 * get approved.
 */
export function applyMlmLimitRules(
  limits: CategoryLimit[],
  categories: Category[],
  _globalMlmCap: number
): CategoryLimit[] {
  const byId = new Map(categories.map((c) => [c.id, c]))

  return limits.map((limit) => {
    const cat = byId.get(limit.categoryId)
    const isMlm = cat ? isMlmCategory(cat) : isSingleSlotMlmBrand(limit.categoryName)
    if (!isMlm) return limit
    return { ...limit, maxSlots: clampMlmMaxSlots(limit.categoryName, cat, limit.maxSlots) }
  })
}

export function hydrateMlmCategoryLimits(
  limits: CategoryLimit[],
  categories: Category[],
  globalMlmCap: number = DEFAULT_GLOBAL_MLM_CAP
): CategoryLimit[] {
  const withSingleSlot = limits.map((limit) => {
    const cat = categories.find((c) => c.id === limit.categoryId)
    const isMlm = cat ? isMlmCategory(cat) : isSingleSlotMlmBrand(limit.categoryName)
    if (!isMlm) return limit
    return { ...limit, maxSlots: 1 }
  })
  return applyMlmLimitRules(withSingleSlot, categories, globalMlmCap)
}
