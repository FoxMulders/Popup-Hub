/**
 * L-Shape Corners — perimeter vending lanes concentrated at hall corners.
 */
import type { VenueElement } from '@/types/database'
import type { WallSide } from '@/lib/booth-planner/venue-elements'
import { applyOutsideOnlyLayout } from '@/lib/booth-planner/outside-only-layout'
import { isPerimeterPlacement } from '@/lib/booth-planner/layout-presets'
import { PERIMETER_VENDING_MARGIN_CELLS } from '@/lib/booth-planner/perimeter-clearance'

const CORNER_FRACTION = 0.28

function inCornerZone(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): boolean {
  const r1 = row + rowSpan - 1
  const c1 = col + colSpan - 1
  const colCut = Math.max(PERIMETER_VENDING_MARGIN_CELLS + 2, Math.floor(cols * CORNER_FRACTION))
  const rowCut = Math.max(PERIMETER_VENDING_MARGIN_CELLS + 2, Math.floor(rows * CORNER_FRACTION))

  const southWest =
    row < rowCut && col < colCut
  const southEast =
    row < rowCut && c1 >= cols - colCut
  const northWest =
    r1 >= rows - rowCut && col < colCut
  const northEast =
    r1 >= rows - rowCut && c1 >= cols - colCut

  return southWest || southEast || northWest || northEast
}

export function applyLShapeCornersLayout(
  cols: number,
  rows: number,
  entrance: WallSide
) {
  return applyOutsideOnlyLayout(cols, rows, entrance)
}

export function isLShapeCornersPlacement(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): boolean {
  if (!isPerimeterPlacement(row, col, rowSpan, colSpan, rows, cols)) return false
  return inCornerZone(row, col, rowSpan, colSpan, rows, cols)
}

export function lShapeCornersOriginsForBooth(
  rows: number,
  cols: number,
  entrance: WallSide,
  rowSpan: number,
  colSpan: number
): [number, number][] {
  const candidates: [number, number][] = []
  for (let r = 0; r <= rows - rowSpan; r++) {
    for (let c = 0; c <= cols - colSpan; c++) {
      if (isLShapeCornersPlacement(r, c, rowSpan, colSpan, rows, cols)) {
        candidates.push([r, c])
      }
    }
  }

  const rank = new Map<string, number>()
  candidates.forEach(([r, c], i) => rank.set(`${r}-${c}`, i))
  return candidates.sort((a, b) => {
    const ra = rank.get(`${a[0]}-${a[1]}`) ?? 0
    const rb = rank.get(`${b[0]}-${b[1]}`) ?? 0
    return ra - rb
  })
}
