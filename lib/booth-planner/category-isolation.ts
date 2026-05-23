import type { CategorySpatialIndex } from '@/lib/booth-planner/category-quadtree'

/** Normalize category labels for "keep alike apart" grouping. */
export function normalizeCategoryKey(name: string, categoryId?: string | null): string {
  if (categoryId) return categoryId
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}

export interface CategoryIsolationOptions {
  categoryKey: string
  index: CategorySpatialIndex
}

/** Higher score = farther from competing same-category booths. */
export function categoryIsolationScore(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  opts: CategoryIsolationOptions
): number {
  const centerR = row + rowSpan / 2
  const centerC = col + colSpan / 2
  const dist = opts.index.minDistanceToCategory(centerR, centerC, opts.categoryKey)
  const spread = opts.index.quadrantSpreadScore(centerR, centerC, opts.categoryKey)
  return dist * 1000 + spread * 250
}
