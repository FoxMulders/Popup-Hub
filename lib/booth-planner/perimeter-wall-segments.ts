import type { VenueElement } from '@/types/database'
import { cellsOfElement, isOuterPerimeterCell } from '@/lib/booth-planner/perimeter-clearance'

function newId(): string {
  return crypto.randomUUID()
}

/**
 * Paint the outer border as merged horizontal/vertical runs — one element per continuous
 * wall segment instead of hundreds of overlapping 1×1 column cells.
 */
export function buildMergedPerimeterWallElements(
  cols: number,
  rows: number,
  skipCells: Set<string> = new Set(),
  label = 'Perimeter wall'
): VenueElement[] {
  if (cols < 1 || rows < 1) return []

  const elements: VenueElement[] = []

  const pushHorizontalRun = (row: number, col: number, colSpan: number) => {
    if (colSpan <= 0) return
    elements.push({
      id: newId(),
      type: 'column',
      row,
      col,
      colSpan,
      rowSpan: 1,
      label,
      locked: true,
    })
  }

  const pushVerticalRun = (row: number, col: number, rowSpan: number) => {
    if (rowSpan <= 0) return
    elements.push({
      id: newId(),
      type: 'column',
      row,
      col,
      colSpan: 1,
      rowSpan,
      label,
      locked: true,
    })
  }

  for (const row of [0, rows - 1]) {
    let runStart: number | null = null
    for (let c = 0; c < cols; c++) {
      const open = !skipCells.has(`${row}-${c}`)
      if (open) {
        if (runStart === null) runStart = c
      } else if (runStart !== null) {
        pushHorizontalRun(row, runStart, c - runStart)
        runStart = null
      }
    }
    if (runStart !== null) pushHorizontalRun(row, runStart, cols - runStart)
  }

  for (const col of [0, cols - 1]) {
    let runStart: number | null = null
    for (let r = 1; r < rows - 1; r++) {
      const open = !skipCells.has(`${r}-${col}`)
      if (open) {
        if (runStart === null) runStart = r
      } else if (runStart !== null) {
        pushVerticalRun(runStart, col, r - runStart)
        runStart = null
      }
    }
    if (runStart !== null) pushVerticalRun(runStart, col, rows - 1 - runStart)
  }

  return elements
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
