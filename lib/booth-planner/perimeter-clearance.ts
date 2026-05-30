import type { VenueElement } from '@/types/database'

/** 4′ expo-style concourse / vending margin interior to the outer wall shell (1 cell = 1 ft). */
export const PERIMETER_VENDING_MARGIN_CELLS = 4

/** @deprecated Use PERIMETER_VENDING_MARGIN_CELLS — kept for callers not yet migrated. */
export const INNER_VENDOR_ZONE_DEPTH_CELLS = PERIMETER_VENDING_MARGIN_CELLS

export function isOuterPerimeterCell(row: number, col: number, cols: number, rows: number): boolean {
  if (cols < 1 || rows < 1) return false
  return row === 0 || row === rows - 1 || col === 0 || col === cols - 1
}

/** Entrance / exit / door cells carved from the outer shell. */
export function collectOpeningCellKeys(elements: ReadonlyArray<VenueElement>): Set<string> {
  const keys = new Set<string>()
  for (const el of elements) {
    if (el.type !== 'entrance' && el.type !== 'exit' && el.type !== 'door') continue
    for (const { row, col } of cellsOfElement(el)) {
      keys.add(`${row}-${col}`)
    }
  }
  return keys
}

/**
 * Outer shell wall cells when perimeter is not painted as locked columns.
 * Respects door openings on row/col 0 / max edges.
 */
export function virtualPerimeterWallCellKeys(
  cols: number,
  rows: number,
  openings: Set<string> = new Set()
): Set<string> {
  const keys = new Set<string>()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isOuterPerimeterCell(r, c, cols, rows)) continue
      const key = `${r}-${c}`
      if (openings.has(key)) continue
      keys.add(key)
    }
  }
  return keys
}

/** 4′ walkable concourse ring parallel to outer walls — fixtures are clipped from this band. */
export function isInnerClearanceCell(row: number, col: number, cols: number, rows: number): boolean {
  return isPerimeterVendingLaneCell(row, col, cols, rows)
}

export function cellsOfElement(el: VenueElement): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = []
  const spanC = el.colSpan ?? 1
  const spanR = el.rowSpan ?? 1
  for (let r = el.row; r < el.row + spanR; r++) {
    for (let c = el.col; c < el.col + spanC; c++) {
      cells.push({ row: r, col: c })
    }
  }
  return cells
}

/**
 * Strip fixtures from the inner vendor ring; clip multi-cell assets that overlap it.
 * Preserves outer-shell walls and entrance/exit openings on row/col 0 / max.
 */
export function clearInnerClearanceRing(
  elements: VenueElement[],
  cols: number,
  rows: number
): VenueElement[] {
  const result: VenueElement[] = []

  for (const el of elements) {
    if (el.type === 'entrance' || el.type === 'exit') {
      result.push(el)
      continue
    }

    if (el.type === 'stage' || /stage stairs/i.test(el.label ?? '')) {
      result.push(el)
      continue
    }

    const occupied = cellsOfElement(el)
    const allOuterWall =
      el.type === 'column' &&
      occupied.every(({ row, col }) => isOuterPerimeterCell(row, col, cols, rows))
    if (allOuterWall) {
      result.push(el)
      continue
    }

    const kept = occupied.filter(({ row, col }) => !isInnerClearanceCell(row, col, cols, rows))
    if (kept.length === 0) continue

    const minR = Math.min(...kept.map((c) => c.row))
    const maxR = Math.max(...kept.map((c) => c.row))
    const minC = Math.min(...kept.map((c) => c.col))
    const maxC = Math.max(...kept.map((c) => c.col))

    result.push({
      ...el,
      row: minR,
      col: minC,
      rowSpan: maxR - minR + 1,
      colSpan: maxC - minC + 1,
    })
  }

  return result
}

/** True when a booth footprint sits in the 4′ inner vendor ring adjacent to walls. */
export function touchesInnerVendorRing(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): boolean {
  if (rows < 3 || cols < 3) return false
  const d = PERIMETER_VENDING_MARGIN_CELLS
  const southInner = d
  const northInner = rows - 1 - d
  const westInner = d
  const eastInner = cols - 1 - d

  const touchesSouth = row <= southInner && row + rowSpan - 1 >= southInner
  const touchesNorth = row <= northInner && row + rowSpan - 1 >= northInner
  const touchesWest = col <= westInner && col + colSpan - 1 >= westInner
  const touchesEast = col <= eastInner && col + colSpan - 1 >= eastInner

  return touchesSouth || touchesNorth || touchesWest || touchesEast
}

/** Walkable 4′ band directly interior to the outer wall shell (Outside only preset). */
export function isPerimeterVendingLaneCell(
  row: number,
  col: number,
  cols: number,
  rows: number
): boolean {
  if (isOuterPerimeterCell(row, col, cols, rows)) return false
  const m = PERIMETER_VENDING_MARGIN_CELLS
  if (rows <= m * 2 + 1 || cols <= m * 2 + 1) return false
  return row <= m || row >= rows - 1 - m || col <= m || col >= cols - 1 - m
}

/** True when any booth cell overlaps the 4′ perimeter vending lane. */
export function boothOverlapsPerimeterVendingLane(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): boolean {
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      if (isPerimeterVendingLaneCell(r, c, cols, rows)) return true
    }
  }
  return false
}
