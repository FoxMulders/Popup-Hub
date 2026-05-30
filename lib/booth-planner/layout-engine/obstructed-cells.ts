import type { VenueElement } from '@/types/database'
import {
  cellsOfElement,
  collectOpeningCellKeys,
  isOuterPerimeterCell,
  virtualPerimeterWallCellKeys,
} from '@/lib/booth-planner/perimeter-clearance'
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
  return virtualPerimeterWallCellKeys(cols, rows, collectOpeningCellKeys(elements))
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
    if (
      el.type === 'column' &&
      cellsOfElement(el).every(({ row, col }) =>
        isOuterPerimeterCell(row, col, cols, rows)
      )
    ) {
      continue
    }
    for (const { row, col } of cellsOfElement(el)) {
      keys.add(cellKey(row, col))
    }
  }
  return keys
}

/** All unpaintable / undroppable cells: virtual outer shell + locked structural zones. */
export function collectObstructedCellKeys(
  elements: VenueElement[],
  cols: number,
  rows: number
): Set<string> {
  const keys = virtualPerimeterWallCellKeys(cols, rows, collectOpeningCellKeys(elements))
  for (const el of elements) {
    if (el.type === 'entrance' || el.type === 'exit') continue
    if (el.type === 'stage') continue
    if (!isFixtureLocked(el)) continue
    for (const { row, col } of cellsOfElement(el)) {
      keys.add(cellKey(row, col))
    }
  }
  return keys
}
