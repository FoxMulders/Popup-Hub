import type { BoothCell } from '@/types/database'
import { compareCategoryNames } from '@/lib/categories'

export interface CategoryVendorSummary {
  categoryName: string
  categoryColor: string
  total: number
  placed: number
  unplaced: number
}

function emptySummary(categoryName: string): CategoryVendorSummary {
  return {
    categoryName,
    categoryColor: 'bg-stone-100 border-stone-300 text-foreground',
    total: 0,
    placed: 0,
    unplaced: 0,
  }
}

export function summarizeVendorsByCategory(
  cells: BoothCell[],
  eventCategoryNames?: string[]
): CategoryVendorSummary[] {
  const map = new Map<
    string,
    { categoryColor: string; total: number; placed: number; unplaced: number }
  >()

  for (const cell of cells) {
    const name = cell.categoryName?.trim() || 'Uncategorized'
    const entry = map.get(name) ?? {
      categoryColor: cell.categoryColor,
      total: 0,
      placed: 0,
      unplaced: 0,
    }
    entry.total += 1
    if (cell.col >= 0 && cell.row >= 0) {
      entry.placed += 1
    } else {
      entry.unplaced += 1
    }
    map.set(name, entry)
  }

  const fromVendors = Array.from(map.entries()).map(([categoryName, stats]) => ({
    categoryName,
    categoryColor: stats.categoryColor,
    total: stats.total,
    placed: stats.placed,
    unplaced: stats.unplaced,
  }))

  if (!eventCategoryNames?.length) {
    return fromVendors.sort((a, b) => compareCategoryNames(a.categoryName, b.categoryName))
  }

  const byName = new Map(fromVendors.map((s) => [s.categoryName, s]))
  const merged = eventCategoryNames.map((name) => byName.get(name) ?? emptySummary(name))
  for (const row of fromVendors) {
    if (!eventCategoryNames.includes(row.categoryName)) {
      merged.push(row)
    }
  }

  return merged.sort((a, b) => compareCategoryNames(a.categoryName, b.categoryName))
}
