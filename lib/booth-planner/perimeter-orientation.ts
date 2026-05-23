import { BOOTH_EQUIPMENT_DEPTH_FT, marketUnitGridSpans } from '@/lib/booth-planner/table-space'
import {
  PERIMETER_VENDING_MARGIN_CELLS,
  boothOverlapsPerimeterVendingLane,
} from '@/lib/booth-planner/perimeter-clearance'

export type PerimeterWall = 'north' | 'south' | 'east' | 'west'

/** Walls touched by a booth footprint (grid row 0 = south, row rows-1 = north). */
export function touchingPerimeterWalls(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): PerimeterWall[] {
  if (rows <= 0 || cols <= 0) return []
  const walls: PerimeterWall[] = []
  const m = PERIMETER_VENDING_MARGIN_CELLS
  const inLane = boothOverlapsPerimeterVendingLane(row, col, rowSpan, colSpan, rows, cols)

  if (row <= 0 || (inLane && row <= m)) walls.push('south')
  if (row + rowSpan >= rows || (inLane && row + rowSpan - 1 >= rows - 1 - m)) walls.push('north')
  if (col <= 0 || (inLane && col <= m)) walls.push('west')
  if (col + colSpan >= cols || (inLane && col + colSpan - 1 >= cols - 1 - m)) walls.push('east')

  return [...new Set(walls)]
}

export function isPerimeterOrigin(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): boolean {
  return touchingPerimeterWalls(row, col, rowSpan, colSpan, rows, cols).length > 0
}

/** Prefer south → north → west → east when a booth touches multiple walls. */
export function pickPrimaryPerimeterWall(walls: PerimeterWall[]): PerimeterWall {
  const order: PerimeterWall[] = ['south', 'north', 'west', 'east']
  for (const w of order) {
    if (walls.includes(w)) return w
  }
  return walls[0]
}

/**
 * Rotate table length parallel to the wall: L cells along the wall, 2′ equipment depth into the room.
 * Horizontal walls (north/south) → L × 2. Vertical walls (east/west) → 2 × L.
 */
export function orientedMarketUnitSpans(
  tableLengthFt: number,
  walls: PerimeterWall[]
): { colSpan: number; rowSpan: number } {
  const L = Math.max(1, Math.round(tableLengthFt))
  if (walls.length === 0) {
    return marketUnitGridSpans(tableLengthFt)
  }
  const primary = pickPrimaryPerimeterWall(walls)
  if (primary === 'north' || primary === 'south') {
    return { colSpan: L, rowSpan: BOOTH_EQUIPMENT_DEPTH_FT }
  }
  return { colSpan: BOOTH_EQUIPMENT_DEPTH_FT, rowSpan: L }
}

/** Resolve footprint for a candidate origin, rotating when snapped to perimeter walls. */
export function resolveBoothSpansAtOrigin(
  row: number,
  col: number,
  tableLengthFt: number,
  rows: number,
  cols: number
): { colSpan: number; rowSpan: number } {
  const defaultSpans = marketUnitGridSpans(tableLengthFt)
  let walls = touchingPerimeterWalls(row, col, defaultSpans.rowSpan, defaultSpans.colSpan, rows, cols)

  if (walls.length === 0) {
    const rotated = {
      colSpan: BOOTH_EQUIPMENT_DEPTH_FT,
      rowSpan: Math.max(1, Math.round(tableLengthFt)),
    }
    walls = touchingPerimeterWalls(row, col, rotated.rowSpan, rotated.colSpan, rows, cols)
    if (walls.length > 0) return orientedMarketUnitSpans(tableLengthFt, walls)
    return defaultSpans
  }

  return orientedMarketUnitSpans(tableLengthFt, walls)
}

/** Locked spans for perimeter placement — always use this instead of default L×2 when touching a wall. */
export function lockedPerimeterSpansAtOrigin(
  row: number,
  col: number,
  tableLengthFt: number,
  rows: number,
  cols: number
): { colSpan: number; rowSpan: number; lockedToWall: boolean } {
  const spans = resolveBoothSpansAtOrigin(row, col, tableLengthFt, rows, cols)
  const defaultSpans = marketUnitGridSpans(tableLengthFt)
  const lockedToWall =
    spans.colSpan !== defaultSpans.colSpan || spans.rowSpan !== defaultSpans.rowSpan
  return { ...spans, lockedToWall }
}

/** Both orientations to try when validating perimeter auto-plan slots. */
export function perimeterOrientationCandidates(tableLengthFt: number): {
  colSpan: number
  rowSpan: number
}[] {
  const L = Math.max(1, Math.round(tableLengthFt))
  return [
    { colSpan: L, rowSpan: BOOTH_EQUIPMENT_DEPTH_FT },
    { colSpan: BOOTH_EQUIPMENT_DEPTH_FT, rowSpan: L },
  ]
}
