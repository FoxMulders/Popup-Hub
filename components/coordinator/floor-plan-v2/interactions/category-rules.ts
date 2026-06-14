/**
 * Category-driven layout rules.
 *
 * Two rules live here, both pure functions so they can run from the
 * The canvas pointer hook and paste pipeline used to enforce this on
 * manual drag/draw; auto-arrange and validation UIs still use it.
 *
 *   1. `isBoothProximityViolation` — same-category booths cannot sit
 *      within 4 grid columns AND 2 grid rows of each other. The grid
 *      origin is the canvas (0,0); column/row distance is measured
 *      edge-to-edge between booth footprints and converted from feet
 *      to grid spaces using `gridSpacingFt` (the document snap unit).
 *      Coordinators
 *      who already placed two same-category booths flush against
 *      each other before this rule existed are not punished — the
 *      function only flags candidate placements that would *create*
 *      a new violation, not pre-existing ones.
 *
 *   2. `nextCategoryName` (re-exported from the palette module) —
 *      sequential category cycling for paste/duplicate flows.
 *
 * The thresholds (4 columns, 2 rows) match the goal spec verbatim:
 *
 *   "If another booth of the exact same Category X is found within
 *    a distance of less than 4 grid spaces horizontally (columns)
 *    AND less than 2 rows vertically, trigger a validation error."
 */

import type { BoothObject, PlacedObject } from '../state/types'

/** "Less than 4 grid columns" — strict inequality. */
export const PROXIMITY_MIN_COLUMNS = 4
/** "Less than 2 grid rows" — strict inequality. */
export const PROXIMITY_MIN_ROWS = 2

interface ProximityViolation {
  /** id of the existing booth the candidate is too close to. */
  conflictId: string
  /** Horizontal edge-to-edge gap in grid column spaces. */
  dxColumns: number
  /** Vertical edge-to-edge gap in grid row spaces. */
  dyRows: number
  /** Category in conflict (mirrors `candidate.categoryName`). */
  category: string
}

export interface BoothFootprintRect {
  x: number
  y: number
  width: number
  height: number
}

/** Edge-to-edge booth separation along each axis, in grid column/row spaces. */
export function boothEdgeGapsInGridSpaces(
  a: BoothFootprintRect,
  b: BoothFootprintRect,
  gridSpacingFt: number
): { dxColumns: number; dyRows: number } {
  if (gridSpacingFt <= 0) {
    return { dxColumns: Number.POSITIVE_INFINITY, dyRows: Number.POSITIVE_INFINITY }
  }

  const overlapX =
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY =
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  const gapXFt =
    overlapX > 0
      ? 0
      : Math.max(a.x - (b.x + b.width), b.x - (a.x + a.width), 0)
  const gapYFt =
    overlapY > 0
      ? 0
      : Math.max(a.y - (b.y + b.height), b.y - (a.y + a.height), 0)

  return {
    dxColumns: gapXFt / gridSpacingFt,
    dyRows: gapYFt / gridSpacingFt,
  }
}

export function sameCategoryProximityViolated(
  a: BoothFootprintRect & { categoryName?: string | null },
  b: BoothFootprintRect & { categoryName?: string | null },
  gridSpacingFt: number,
  options?: { minColumns?: number; minRows?: number }
): boolean {
  const catA = a.categoryName?.trim().toLowerCase()
  const catB = b.categoryName?.trim().toLowerCase()
  if (!catA || !catB || catA !== catB) return false
  const minCols = options?.minColumns ?? PROXIMITY_MIN_COLUMNS
  const minRows = options?.minRows ?? PROXIMITY_MIN_ROWS
  const { dxColumns, dyRows } = boothEdgeGapsInGridSpaces(a, b, gridSpacingFt)
  return dxColumns < minCols && dyRows < minRows
}

/**
 * Check whether placing `candidate` (at its current x/y) would violate
 * the same-category proximity rule against any other booth in
 * `others`. Untagged booths (no `categoryName`) are exempt — the rule
 * is scoped to identical category labels.
 *
 * Returns the first conflicting violation found, or `null` when the
 * candidate is safely placed. Distances are reported in grid spaces
 * so callers can build helpful error messages without re-doing the
 * math.
 *
 * Self-comparison is skipped (the candidate is allowed to keep its
 * own id in `others` — useful when called from a drag-end commit
 * where the moved booth still appears in the doc's object list).
 */
export function findBoothProximityViolation(
  candidate: BoothObject,
  others: ReadonlyArray<PlacedObject>,
  gridSpacingFt: number,
  options?: {
    minColumns?: number
    minRows?: number
  }
): ProximityViolation | null {
  if (!candidate.categoryName) return null
  if (gridSpacingFt <= 0) return null
  const cat = candidate.categoryName.trim().toLowerCase()
  if (!cat) return null
  const minCols = options?.minColumns ?? PROXIMITY_MIN_COLUMNS
  const minRows = options?.minRows ?? PROXIMITY_MIN_ROWS
  const candidateRect: BoothFootprintRect = {
    x: candidate.x,
    y: candidate.y,
    width: candidate.width,
    height: candidate.height,
  }

  for (const other of others) {
    if (other.id === candidate.id) continue
    if (other.kind !== 'booth') continue
    const otherBooth = other as BoothObject
    const otherCat = otherBooth.categoryName?.trim().toLowerCase()
    if (!otherCat || otherCat !== cat) continue

    const { dxColumns, dyRows } = boothEdgeGapsInGridSpaces(candidateRect, otherBooth, gridSpacingFt)
    if (dxColumns < minCols && dyRows < minRows) {
      return {
        conflictId: otherBooth.id,
        dxColumns,
        dyRows,
        category: candidate.categoryName,
      }
    }
  }
  return null
}

/**
 * Convenience boolean wrapper for callers that just need a yes/no
 * answer.
 */
export function isBoothProximityViolation(
  candidate: BoothObject,
  others: ReadonlyArray<PlacedObject>,
  gridSpacingFt: number,
  options?: { minColumns?: number; minRows?: number }
): boolean {
  return (
    findBoothProximityViolation(candidate, others, gridSpacingFt, options) !==
    null
  )
}

/**
 * Run the proximity rule across a multi-booth move (drag-end or
 * paste commit). Returns the first violation found, or `null` if all
 * candidates fit. `others` should include every booth NOT in the
 * candidate set; the function never compares two candidates against
 * each other so a coordinator dragging two same-category booths
 * together as a pair won't false-trigger on themselves.
 */
export function findFirstViolationInMove(
  candidates: ReadonlyArray<BoothObject>,
  others: ReadonlyArray<PlacedObject>,
  gridSpacingFt: number,
  options?: { minColumns?: number; minRows?: number }
): ProximityViolation | null {
  for (const c of candidates) {
    const v = findBoothProximityViolation(c, others, gridSpacingFt, options)
    if (v) return v
  }
  return null
}

export type { ProximityViolation }
