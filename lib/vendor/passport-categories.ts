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
