import { MIN_CLEARANCE_FT } from '@/lib/booth-planner/layout-clearance-constants'

export { MIN_CLEARANCE_FT }

/** Strict booth safety margin (ft) — alias for layout validators. */
export const MIN_CLEARANCE = MIN_CLEARANCE_FT

export interface FootprintRect {
  x: number
  y: number
  width: number
  height: number
}

const EPS = 1e-4

function rectsOverlap(a: FootprintRect, b: FootprintRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

/**
 * Expanded footprint bounding box for hard-constraint placement evaluation.
 * Raw width/length each grow by {@link MIN_CLEARANCE} × 2 (3′ per side).
 */
export function expandedFootprintBBox(raw: FootprintRect): FootprintRect {
  const m = MIN_CLEARANCE
  return {
    x: raw.x - m,
    y: raw.y - m,
    width: raw.width + m * 2,
    height: raw.height + m * 2,
  }
}

/** True when two raw footprints violate the expanded-footprint separation rule. */
export function expandedFootprintsOverlap(
  a: FootprintRect,
  b: FootprintRect
): boolean {
  return rectsOverlap(expandedFootprintBBox(a), expandedFootprintBBox(b))
}

/** Raw booth footprint must sit at least {@link MIN_CLEARANCE} from room walls. */
export function footprintWithinWallClearance(
  raw: FootprintRect,
  roomW: number,
  roomH: number,
  clearanceFt = MIN_CLEARANCE
): boolean {
  return (
    raw.x >= clearanceFt - EPS &&
    raw.y >= clearanceFt - EPS &&
    raw.x + raw.width <= roomW - clearanceFt + EPS &&
    raw.y + raw.height <= roomH - clearanceFt + EPS
  )
}

/** Perimeter / grid walk step — one expanded footprint span along an axis. */
export function perimeterStepFt(rawSpanFt: number): number {
  return rawSpanFt + MIN_CLEARANCE * 2
}

/**
 * Hard-constraint placement validator — call before accepting any booth coordinate.
 * Rejects positions within {@link MIN_CLEARANCE} of walls or whose expanded footprint
 * intersects another booth's 3′ safety buffer (6′ minimum between physical borders).
 */
export function validateBoothPlacementCoordinate(
  raw: FootprintRect,
  roomW: number,
  roomH: number,
  placedExpanded: ReadonlyArray<FootprintRect>
): boolean {
  if (!footprintWithinWallClearance(raw, roomW, roomH, MIN_CLEARANCE)) {
    return false
  }
  const expanded = expandedFootprintBBox(raw)
  return !placedExpanded.some((other) => rectsOverlap(expanded, other))
}

/** @deprecated Use {@link validateBoothPlacementCoordinate}. */
export function passesHardPlacementConstraint(
  raw: FootprintRect,
  roomW: number,
  roomH: number,
  placedExpanded: ReadonlyArray<FootprintRect>
): boolean {
  return validateBoothPlacementCoordinate(raw, roomW, roomH, placedExpanded)
}

/** Check one candidate against already-placed raw footprints (expands internally). */
export function validateBoothAgainstPlaced(
  raw: FootprintRect,
  roomW: number,
  roomH: number,
  placedRaw: ReadonlyArray<FootprintRect>
): boolean {
  const placedExpanded = placedRaw.map((r) => expandedFootprintBBox(r))
  return validateBoothPlacementCoordinate(raw, roomW, roomH, placedExpanded)
}

/** @deprecated Back-to-back pairs no longer bypass the safety buffer. */
export function boothsShareBackToBackEdge(
  _a: FootprintRect,
  _b: FootprintRect
): boolean {
  return false
}
