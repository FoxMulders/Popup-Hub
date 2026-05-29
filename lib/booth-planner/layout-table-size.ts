import type { BoothCell, LayoutSpacingMode, VenueElement } from '@/types/database'
import { isTentVendor } from '@/lib/booth-planner/vendor-unit-types'
import { validateAutoLayoutPlacement } from '@/lib/booth-planner/layout-validation'
import { analyzeStrollerClearance } from '@/lib/booth-planner/stroller-clearance'
import {
  gridSpansForTableOrientation,
  type TableOrientation,
} from '@/lib/booth-planner/table-orientation'
import { marketUnitGridSpans, tableFootprintToGridSpans } from '@/lib/booth-planner/table-space'

/** Venue-wide table lengths — one size per hall, applied to every table vendor. */
export const LAYOUT_BASELINE_TABLE_LENGTHS_FT = [
  5, 6, 7, 8, 9, 10, 12, 15, 18,
] as const
export type LayoutBaselineTableLengthFt = (typeof LAYOUT_BASELINE_TABLE_LENGTHS_FT)[number]

export const DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT: LayoutBaselineTableLengthFt = 6

export function isLayoutBaselineTableLengthFt(ft: number): ft is LayoutBaselineTableLengthFt {
  return (LAYOUT_BASELINE_TABLE_LENGTHS_FT as readonly number[]).includes(ft)
}

/** Booth equipment footprint on the 1′ grid: L columns × 2 rows (8′ aisle co-generated separately). */
export function layoutBaselineGridSpans(tableLengthFt: number): {
  colSpan: number
  rowSpan: number
} {
  return marketUnitGridSpans(tableLengthFt)
}

export function gridSpansForTableLength(
  tableLengthFt: number,
  spacingMode: LayoutSpacingMode,
  orientation?: TableOrientation | null
): { colSpan: number; rowSpan: number } {
  if (orientation) {
    return gridSpansForTableOrientation(tableLengthFt, spacingMode, orientation)
  }
  if (spacingMode === 'one_foot') {
    return layoutBaselineGridSpans(tableLengthFt)
  }
  if (spacingMode === 'table_provided') {
    return tableFootprintToGridSpans(tableLengthFt)
  }
  return { colSpan: 1, rowSpan: 1 }
}

export function applyBaselineTableLengthToCells(
  cells: BoothCell[],
  tableLengthFt: number,
  spacingMode: LayoutSpacingMode
): BoothCell[] {
  if (spacingMode === 'standard') {
    return cells
  }
  return cells.map((cell) => {
    if (isTentVendor(cell.vendorUnitType)) return cell
    const oriented = gridSpansForTableLength(
      tableLengthFt,
      spacingMode,
      cell.tableOrientation
    )
    return {
      ...cell,
      colSpan: oriented.colSpan,
      rowSpan: oriented.rowSpan,
      tableLengthFt,
    }
  })
}

export function baselineTableSizeChangeMessage(tableLengthFt: number): string {
  return `⚠️ Cannot change table size to ${tableLengthFt}ft. This size causes layout overlaps or blocks mandatory 8ft stroller paths. Clear some space first!`
}

export type BaselineTableSizeValidationResult =
  | { ok: true; cells: BoothCell[] }
  | { ok: false; message: string }

/** Validate a cell layout after span changes; reject overlaps or &lt;8′ stroller paths. */
export function validateTableSizeLayout(input: {
  tableLengthFt: number
  cells: BoothCell[]
  rows: number
  cols: number
  blocked: Set<string>
  venueElements: VenueElement[]
  cellWidthFt: number
  cellLengthFt: number
}): BaselineTableSizeValidationResult {
  const {
    tableLengthFt,
    cells,
    rows,
    cols,
    blocked,
    venueElements,
    cellWidthFt,
    cellLengthFt,
  } = input

  const placed = cells.filter((c) => c.col >= 0 && c.row >= 0)
  if (placed.length === 0) {
    return { ok: true, cells }
  }

  const layoutCheck = validateAutoLayoutPlacement({
    cells: placed,
    rows,
    cols,
    blocked,
    venueElements,
  })
  if (!layoutCheck.valid) {
    return { ok: false, message: baselineTableSizeChangeMessage(tableLengthFt) }
  }

  const clearance = analyzeStrollerClearance({
    rows,
    cols,
    boothWidthFt: cellWidthFt,
    boothLengthFt: cellLengthFt,
    cells,
    venueElements,
  })
  if (clearance.hasBottleneck) {
    return { ok: false, message: baselineTableSizeChangeMessage(tableLengthFt) }
  }

  return { ok: true, cells }
}

/** Resize every booth to the baseline footprint, then validate. */
export function validateBaselineTableSizeChange(input: {
  tableLengthFt: number
  cells: BoothCell[]
  rows: number
  cols: number
  blocked: Set<string>
  venueElements: VenueElement[]
  spacingMode: LayoutSpacingMode
  cellWidthFt: number
  cellLengthFt: number
}): BaselineTableSizeValidationResult {
  const nextCells = applyBaselineTableLengthToCells(
    input.cells,
    input.tableLengthFt,
    input.spacingMode
  )
  return validateTableSizeLayout({
    tableLengthFt: input.tableLengthFt,
    cells: nextCells,
    rows: input.rows,
    cols: input.cols,
    blocked: input.blocked,
    venueElements: input.venueElements,
    cellWidthFt: input.cellWidthFt,
    cellLengthFt: input.cellLengthFt,
  })
}

export function inferBaselineTableLengthFromCells(
  cells: BoothCell[],
  fallback: LayoutBaselineTableLengthFt = DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
): LayoutBaselineTableLengthFt {
  const placed = cells.find((c) => c.col >= 0 && c.tableLengthFt != null)
  if (placed?.tableLengthFt != null && isLayoutBaselineTableLengthFt(placed.tableLengthFt)) {
    return placed.tableLengthFt
  }
  return fallback
}
