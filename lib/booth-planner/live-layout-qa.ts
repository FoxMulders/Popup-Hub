import type { BoothCell, VenueElement } from '@/types/database'
import { validateAutoLayoutPlacement } from '@/lib/booth-planner/layout-validation'
import { detectLayoutOverlaps } from '@/lib/booth-planner/layout-overlap'
import { analyzeStrollerClearance } from '@/lib/booth-planner/stroller-clearance'
import { blockedCellKeys } from '@/lib/booth-planner/venue-elements'
import { CategorySpatialIndex } from '@/lib/booth-planner/category-quadtree'
import { normalizeCategoryKey } from '@/lib/booth-planner/category-isolation'

export interface LiveLayoutQaInput {
  cells: BoothCell[]
  venueElements: VenueElement[]
  rows: number
  cols: number
  cellWidthFt: number
  cellLengthFt: number
}

export interface LiveLayoutQaResult {
  checkedAt: number
  hasOverlap: boolean
  overlapCellCount: number
  hasStrollerBottleneck: boolean
  strollerBottleneckCount: number
  placementValid: boolean
  categoryIndexSize: number
  fingerprint: string
}

export function liveLayoutFingerprint(input: LiveLayoutQaInput): string {
  const placed = input.cells
    .filter((c) => c.col >= 0)
    .map((c) => `${c.id}@${c.col},${c.row}:${c.colSpan}x${c.rowSpan}`)
    .sort()
    .join('|')
  const fixtures = input.venueElements
    .map((e) => `${e.id}@${e.col},${e.row}:${e.colSpan ?? 1}x${e.rowSpan ?? 1}`)
    .sort()
    .join('|')
  return `${input.cols}x${input.rows}::${placed}::${fixtures}`
}

/** Synchronous QA desk checks — overlap bitmask, stroller aisles, placement validity, quadtree. */
export function runLiveLayoutChecks(input: LiveLayoutQaInput): LiveLayoutQaResult {
  const blocked = blockedCellKeys(input.venueElements)
  const overlaps = detectLayoutOverlaps({
    cells: input.cells,
    rows: input.rows,
    cols: input.cols,
    venueElements: input.venueElements,
  })
  const stroller = analyzeStrollerClearance({
    rows: input.rows,
    cols: input.cols,
    boothWidthFt: input.cellWidthFt,
    boothLengthFt: input.cellLengthFt,
    cells: input.cells,
    venueElements: input.venueElements,
  })
  const placed = input.cells.filter((c) => c.col >= 0 && c.row >= 0)
  const placement = validateAutoLayoutPlacement({
    cells: placed,
    rows: input.rows,
    cols: input.cols,
    blocked,
    venueElements: input.venueElements,
  })

  const categoryIndex = new CategorySpatialIndex(input.cols, input.rows)
  for (const cell of placed) {
    categoryIndex.insert(
      cell.row + cell.rowSpan / 2,
      cell.col + cell.colSpan / 2,
      normalizeCategoryKey(cell.categoryName)
    )
  }

  return {
    checkedAt: Date.now(),
    hasOverlap: overlaps.hasOverlap,
    overlapCellCount: overlaps.overlapKeys.size,
    hasStrollerBottleneck: stroller.hasBottleneck,
    strollerBottleneckCount: stroller.bottleneckKeys.size,
    placementValid: placement.valid,
    categoryIndexSize: placed.length,
    fingerprint: liveLayoutFingerprint(input),
  }
}
