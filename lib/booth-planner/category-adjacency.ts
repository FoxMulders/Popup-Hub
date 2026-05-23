import type { BoothCell } from '@/types/database'
import { normalizeCategoryKey } from '@/lib/booth-planner/category-isolation'
import { VendorPlacementGuard } from '@/lib/booth-planner/vendor-placement-guards'

/** Max identical categories side-by-side in a row segment (legacy row-band cap). */
export const MAX_SAME_CATEGORY_ADJACENT = 1

function boothAt(cells: BoothCell[], row: number, col: number): BoothCell | null {
  for (const b of cells) {
    if (b.col < 0) continue
    if (
      row >= b.row &&
      row < b.row + b.rowSpan &&
      col >= b.col &&
      col < b.col + b.colSpan
    ) {
      return b
    }
  }
  return null
}

/** Contiguous same-category booth count in a row band including a candidate at col..col+colSpan. */
export function sameCategoryAdjacentBoothCount(
  cells: BoothCell[],
  categoryKey: string,
  row: number,
  col: number,
  colSpan: number
): number {
  const visited = new Set<string>()
  let count = 0

  const absorb = (r: number, c: number) => {
    const b = boothAt(cells, r, c)
    if (!b || visited.has(b.id)) return
    if (normalizeCategoryKey(b.categoryName) !== categoryKey) return
    visited.add(b.id)
    count += 1
  }

  for (let c = col; c < col + colSpan; c++) absorb(row, c)

  if (count === 0) count = 1

  let scanCol = col - 1
  while (scanCol >= 0) {
    const b = boothAt(cells, row, scanCol)
    if (!b || normalizeCategoryKey(b.categoryName) !== categoryKey) break
    if (!visited.has(b.id)) {
      visited.add(b.id)
      count += 1
    }
    scanCol = b.col - 1
  }

  scanCol = col + colSpan
  while (true) {
    const b = boothAt(cells, row, scanCol)
    if (!b || normalizeCategoryKey(b.categoryName) !== categoryKey) break
    if (!visited.has(b.id)) {
      visited.add(b.id)
      count += 1
    }
    scanCol = b.col + b.colSpan
  }

  return count
}

export function categoryAdjacencyLimitViolated(
  cells: BoothCell[],
  categoryKey: string,
  row: number,
  col: number,
  colSpan: number,
  rowSpan = 2
): boolean {
  const placed = cells.filter((c) => c.col >= 0 && c.row >= 0)
  if (placed.length === 0) return false

  const sample = placed[0]
  const cols = Math.max(
    ...placed.map((c) => c.col + c.colSpan),
    col + colSpan
  )
  const rows = Math.max(
    ...placed.map((c) => c.row + c.rowSpan),
    row + rowSpan,
    sample?.rowSpan ?? rowSpan
  )

  const guard = VendorPlacementGuard.fromPlacedCells({
    cols,
    rows,
    placedCells: placed,
  })

  return guard.rejectsAutoPlacement({
    categoryKey,
    row,
    col,
    rowSpan,
    colSpan,
  })
}
