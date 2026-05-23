import type { VenueElement } from '@/types/database'
import { cellsOfElement, isOuterPerimeterCell } from '@/lib/booth-planner/perimeter-clearance'
import { isPerimeterWallElement } from '@/lib/booth-planner/perimeter-wall-segments'
import { isFixtureLocked } from '@/lib/booth-planner/venue-elements'

function cellKey(row: number, col: number): string {
  return `${row}-${col}`
}

/** Outer shell wall cells (1-cell boundary), excluding walkable door openings. */
export function collectPerimeterWallCellKeys(
  elements: VenueElement[],
  cols: number,
  rows: number
): Set<string> {
  const keys = new Set<string>()
  for (const el of elements) {
    if (el.type !== 'column' || !isPerimeterWallElement(el, cols, rows)) continue
    for (const { row, col } of cellsOfElement(el)) {
      keys.add(cellKey(row, col))
    }
  }
  return keys
}

/** Locked structural fixtures (Bar, Stage, template locks) — unpaintable and undroppable. */
export function collectLockedStructuralCellKeys(
  elements: VenueElement[],
  cols: number,
  rows: number
): Set<string> {
  const keys = new Set<string>()
  for (const el of elements) {
    if (!isFixtureLocked(el)) continue
    if (el.type === 'entrance' || el.type === 'exit') continue
    if (el.type === 'column' && isPerimeterWallElement(el, cols, rows)) continue
    for (const { row, col } of cellsOfElement(el)) {
      keys.add(cellKey(row, col))
    }
  }
  return keys
}

/** All unpaintable / undroppable cells: perimeter walls + locked structural zones. */
export function collectObstructedCellKeys(
  elements: VenueElement[],
  cols: number,
  rows: number
): Set<string> {
  const keys = new Set<string>()
  for (const el of elements) {
    if (el.type === 'entrance' || el.type === 'exit') continue
    if (el.type === 'stage') continue
    const isWall =
      el.type === 'column' &&
      cellsOfElement(el).every(({ row, col }) => isOuterPerimeterCell(row, col, cols, rows))
    const isLockedStructural = isFixtureLocked(el) && !isWall
    if (!isWall && !isLockedStructural) continue
    for (const { row, col } of cellsOfElement(el)) {
      keys.add(cellKey(row, col))
    }
  }
  return keys
}
