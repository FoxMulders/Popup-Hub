import {
  categoryNamesForIds,
  resolvePassportCategoryIds,
} from '@/lib/vendor/passport-categories'

type ApplicationCategorySource = {
  category?: { name?: string | null } | null
  category_id?: string | null
  passport?: {
    category_ids?: string[] | null
    primary_category_id?: string | null
    category?: { name?: string | null } | null
  } | null
}

export function resolveApplicationDisplayCategories(
  application: ApplicationCategorySource,
  categoryNameById: Map<string, string> | Record<string, string>
): string[] {
  const categoryMap =
    categoryNameById instanceof Map
      ? categoryNameById
      : new Map(Object.entries(categoryNameById))
  const passportIds = resolvePassportCategoryIds(application.passport ?? {})
  if (passportIds.length > 0) {
    const names = categoryNamesForIds(
      passportIds,
      [...categoryMap.entries()].map(([id, name]) => ({ id, name }))
    )
    if (names.length > 0) return names
  }

  const primaryName = application.passport?.category?.name?.trim()
  if (primaryName) return [primaryName]

  const applicationCategoryName = application.category?.name?.trim()
  if (applicationCategoryName) return [applicationCategoryName]

  if (application.category_id) {
    const mapped = categoryMap.get(application.category_id)
    if (mapped) return [mapped]
  }

  return ['Unassigned']
}

export function buildCategoryNameMap(
  categories: Array<{ id: string; name: string }>
): Map<string, string> {
  return new Map(categories.map((category) => [category.id, category.name]))
}
