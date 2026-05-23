/**
 * Aligned Grid — E–W rows on a uniform grid (delegates to horizontal row shell).
 */
import type { VenueElement } from '@/types/database'
import type { WallSide } from '@/lib/booth-planner/venue-elements'
import {
  applyGenericRowLayout,
  horizontalRowsOriginsForBooth,
  isHorizontalRowsPlacement,
} from '@/lib/booth-planner/generic-row-layouts'

export function applyAlignedGridLayout(
  cols: number,
  rows: number,
  entrance: WallSide,
  baseElements: VenueElement[]
) {
  return applyGenericRowLayout('horizontal_rows', cols, rows, entrance, baseElements)
}

export function alignedGridOriginsForBooth(
  rows: number,
  cols: number,
  entrance: WallSide,
  rowSpan: number,
  colSpan: number
): [number, number][] {
  return horizontalRowsOriginsForBooth(rows, cols, entrance, rowSpan, colSpan)
}

export function isAlignedGridPlacement(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): boolean {
  return isHorizontalRowsPlacement(row, col, rowSpan, colSpan, rows, cols)
}
