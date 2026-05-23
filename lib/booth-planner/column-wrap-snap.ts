import type { VenueElement } from '@/types/database'
import { BOOTH_SAFETY_BUFFER_CELLS } from '@/lib/booth-planner/layout-clearance-constants'

const SNAP_PROXIMITY_CELLS = 3

function isStructuralColumn(el: VenueElement): boolean {
  return el.type === 'column' && !el.label?.toLowerCase().includes('perimeter')
}

/** Snap booth origin flush to nearest column when within 3′; column absorbs rear buffer. */
export function snapBoothToColumn(
  targetRow: number,
  targetCol: number,
  rowSpan: number,
  colSpan: number,
  columns: VenueElement[]
): { row: number; col: number } {
  let bestRow = targetRow
  let bestCol = targetCol
  let bestDist = SNAP_PROXIMITY_CELLS + 1

  for (const col of columns) {
    if (!isStructuralColumn(col)) continue
    const cr = col.row
    const cc = col.col

    const candidates: { row: number; col: number }[] = [
      { row: targetRow, col: cc + 1 },
      { row: targetRow, col: cc - colSpan },
      { row: cr + 1, col: targetCol },
      { row: cr - rowSpan, col: targetCol },
    ]

    for (const cand of candidates) {
      const dist =
        Math.abs(cand.row - targetRow) + Math.abs(cand.col - targetCol)
      if (dist <= SNAP_PROXIMITY_CELLS && dist < bestDist) {
        bestDist = dist
        bestRow = cand.row
        bestCol = cand.col
      }
    }
  }

  return { row: bestRow, col: bestCol }
}

/** Column footprint may overlap the booth's rear 2′ buffer ring only. */
export function columnWrapAllowsPlacement(
  boothRow: number,
  boothCol: number,
  rowSpan: number,
  colSpan: number,
  column: VenueElement
): boolean {
  const cr = column.row
  const cc = column.col
  const buffer = BOOTH_SAFETY_BUFFER_CELLS
  const r0 = boothRow - buffer
  const r1 = boothRow + rowSpan - 1 + buffer
  const c0 = boothCol - buffer
  const c1 = boothCol + colSpan - 1 + buffer

  const coreR0 = boothRow
  const coreR1 = boothRow + rowSpan - 1
  const coreC0 = boothCol
  const coreC1 = boothCol + colSpan - 1

  if (cr >= coreR0 && cr <= coreR1 && cc >= coreC0 && cc <= coreC1) return false
  if (cr < r0 || cr > r1 || cc < c0 || cc > c1) return true
  return true
}
