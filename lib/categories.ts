/** Sort category records A→Z by display name. */
export function sortCategoriesByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name))
}

export function compareCategoryNames(a: string, b: string): number {
  return a.localeCompare(b)
}
