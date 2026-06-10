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
 *      between booth centers and converted from grid spaces to feet
 *      using `gridSpacingFt` (the document's snap unit). Coordinators
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
  /** column-axis distance between booth centers, in grid spaces. */
  dxColumns: number
  /** row-axis distance between booth centers, in grid spaces. */
  dyRows: number
  /** Category in conflict (mirrors `candidate.categoryName`). */
  category: string
}

function boothCenter(b: { x: number; y: number; width: number; height: number }) {
  return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 }
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

  const { cx: ccx, cy: ccy } = boothCenter(candidate)

  for (const other of others) {
    if (other.id === candidate.id) continue
    if (other.kind !== 'booth') continue
    const otherBooth = other as BoothObject
    const otherCat = otherBooth.categoryName?.trim().toLowerCase()
    if (!otherCat || otherCat !== cat) continue

    const { cx: ocx, cy: ocy } = boothCenter(otherBooth)
    const dxFt = Math.abs(ccx - ocx)
    const dyFt = Math.abs(ccy - ocy)
    const dxColumns = dxFt / gridSpacingFt
    const dyRows = dyFt / gridSpacingFt
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
