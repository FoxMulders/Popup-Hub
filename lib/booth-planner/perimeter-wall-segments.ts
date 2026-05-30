import type { VenueElement } from '@/types/database'
import { cellsOfElement, isOuterPerimeterCell } from '@/lib/booth-planner/perimeter-clearance'

function newId(): string {
  return crypto.randomUUID()
}

/**
 * Locked perimeter column paint is disabled — the outer shell is enforced
 * virtually via `virtualPerimeterWallCellKeys` (placement / pathfinding).
 */
export function buildMergedPerimeterWallElements(
  _cols: number,
  _rows: number,
  _skipCells: Set<string> = new Set(),
  _label = 'Perimeter wall'
): VenueElement[] {
  return []
}

/** Drop legacy locked perimeter column segments from saved venue_elements. */
export function stripLockedPerimeterWallElements(
  elements: ReadonlyArray<VenueElement>,
  cols: number,
  rows: number
): VenueElement[] {
  return elements.filter(
    (el) => !(el.type === 'column' && isPerimeterWallElement(el, cols, rows))
  )
}

/** True when every cell in the element lies on the outer shell. */
export function isPerimeterWallElement(el: VenueElement, cols: number, rows: number): boolean {
  if (el.type !== 'column') return false
  const occupied = cellsOfElement(el)
  if (occupied.length === 0) return false
  return occupied.every(({ row, col }) => isOuterPerimeterCell(row, col, cols, rows))
}

/** Whether a venue element occupies a grid cell (any origin / span). */
export function venueElementCoversCell(el: VenueElement, row: number, col: number): boolean {
  const spanC = el.colSpan ?? 1
  const spanR = el.rowSpan ?? 1
  return (
    row >= el.row &&
    row < el.row + spanR &&
    col >= el.col &&
    col < el.col + spanC
  )
}

/** Find a column element covering this outer-perimeter cell, if any. */
export function perimeterWallAt(
  elements: VenueElement[],
  row: number,
  col: number,
  cols: number,
  rows: number
): VenueElement | undefined {
  return elements.find(
    (el) =>
      el.type === 'column' &&
      isPerimeterWallElement(el, cols, rows) &&
      venueElementCoversCell(el, row, col)
  )
}
