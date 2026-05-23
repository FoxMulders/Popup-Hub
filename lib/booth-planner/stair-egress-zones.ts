import type { VenueElement } from '@/types/database'
import { cellsOfElement } from '@/lib/booth-planner/perimeter-clearance'

/** Pedestrian code stair width (3.5′). */
export const STAIR_STANDARD_WIDTH_FT = 3.5

/** Landing clear zone at each stair terminal (4′ × 4′). */
export const STAIR_LANDING_SIZE_CELLS = 4

function cellKey(row: number, col: number): string {
  return `${row}-${col}`
}

function isStairElement(el: VenueElement): boolean {
  if (/stair/i.test(el.label ?? '')) return true
  return false
}

/** 4×4 landing squares at top and bottom stair terminals. */
export function landingZonesForStair(
  el: VenueElement,
  hallRows: number,
  cols: number,
  rows: number
): Set<string> {
  const keys = new Set<string>()
  const spanC = el.colSpan ?? 1
  const spanR = el.rowSpan ?? 1
  const centerCol = el.col + Math.floor(spanC / 2)
  const half = Math.floor(STAIR_LANDING_SIZE_CELLS / 2)

  const bottomRow = hallRows - 1
  const bottomStartCol = Math.max(0, centerCol - half)
  const bottomStartRow = Math.max(0, bottomRow - STAIR_LANDING_SIZE_CELLS + 1)
  for (let r = bottomStartRow; r <= bottomRow; r++) {
    for (let c = bottomStartCol; c < bottomStartCol + STAIR_LANDING_SIZE_CELLS && c < cols; c++) {
      keys.add(cellKey(r, c))
    }
  }

  const topRow = el.row + spanR - 1
  const topStartRow = Math.max(hallRows, topRow - STAIR_LANDING_SIZE_CELLS + 1)
  const topStartCol = Math.max(0, centerCol - half)
  for (let r = topStartRow; r <= topRow && r < rows; r++) {
    for (let c = topStartCol; c < topStartCol + STAIR_LANDING_SIZE_CELLS && c < cols; c++) {
      keys.add(cellKey(r, c))
    }
  }

  for (const { row, col } of cellsOfElement(el)) {
    keys.add(cellKey(row, col))
  }

  return keys
}

export function collectStairEgressZoneKeys(
  elements: VenueElement[],
  hallRows: number,
  cols: number,
  rows: number
): Set<string> {
  const keys = new Set<string>()
  for (const el of elements) {
    if (!isStairElement(el)) continue
    for (const k of landingZonesForStair(el, hallRows, cols, rows)) {
      keys.add(k)
    }
  }
  return keys
}
