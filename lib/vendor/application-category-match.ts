import { resolvePassportCategoryIds } from '@/lib/vendor/passport-categories'

export type CategorySlotInfo = {
  categoryId: string
  categoryName: string
  maxSlots: number
  availableSlots: number
  pricePerBooth: number
  requiresDocumentation?: boolean
}

export type PassportCategoryMatch = {
  passportSlots: CategorySlotInfo[]
  fullCategoryNames: string[]
  openCategoryNames: string[]
  allCategoriesFull: boolean
  hasOpenCategory: boolean
  hasCategoryOverflow: boolean
  resolvedCategoryId: string | null
  resolvedSlot: CategorySlotInfo | null
  waitlistCategoryId: string | null
}

export function evaluatePassportCategoryMatch(
  passport: {
    category_ids?: string[] | null
    primary_category_id?: string | null
  },
  eventSlots: CategorySlotInfo[]
): PassportCategoryMatch {
  const passportCategoryIds = resolvePassportCategoryIds(passport)
  const passportSlots = eventSlots.filter((slot) => passportCategoryIds.includes(slot.categoryId))

  const fullCategoryNames = passportSlots
    .filter((slot) => slot.availableSlots <= 0)
    .map((slot) => slot.categoryName)
  const openCategoryNames = passportSlots
    .filter((slot) => slot.availableSlots > 0)
    .map((slot) => slot.categoryName)

  const allCategoriesFull =
    passportSlots.length > 0 && passportSlots.every((slot) => slot.availableSlots <= 0)
  const hasOpenCategory = openCategoryNames.length > 0
  const hasCategoryOverflow =
    passportSlots.length > 1 && hasOpenCategory && fullCategoryNames.length > 0

  const primaryId = passport.primary_category_id ?? passportCategoryIds[0] ?? null
  const primaryOpen = primaryId
    ? passportSlots.find((slot) => slot.categoryId === primaryId && slot.availableSlots > 0)
    : null
  const firstOpen = passportSlots.find((slot) => slot.availableSlots > 0) ?? null
  const resolvedSlot = primaryOpen ?? firstOpen
  const waitlistSlot =
    (primaryId ? passportSlots.find((slot) => slot.categoryId === primaryId) : null) ??
    passportSlots[0] ??
    null

  return {
    passportSlots,
    fullCategoryNames,
    openCategoryNames,
    allCategoriesFull,
    hasOpenCategory,
    hasCategoryOverflow,
    resolvedCategoryId: resolvedSlot?.categoryId ?? null,
    resolvedSlot,
    waitlistCategoryId: waitlistSlot?.categoryId ?? null,
  }
}

export function formatCategoryOverflowLabel(fullCategoryNames: string[]): string {
  if (fullCategoryNames.length === 0) return ''
  if (fullCategoryNames.length === 1) {
    return `Multi-Category Exception: ${fullCategoryNames[0]} Full`
  }
  return `Multi-Category Exception: ${fullCategoryNames.join(', ')} Full`
}
