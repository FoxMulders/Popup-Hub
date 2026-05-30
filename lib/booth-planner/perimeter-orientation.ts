import type { StorefrontSide } from '@/lib/booth-planner/aisle-orientation'
import { tableOrientationForStorefront } from '@/lib/booth-planner/facing-target'
import { cellKey } from '@/lib/booth-planner/venue-elements'
import { BOOTH_EQUIPMENT_DEPTH_FT, marketUnitGridSpans } from '@/lib/booth-planner/table-space'
import type { TableOrientation } from '@/lib/booth-planner/table-orientation'
import {
  PERIMETER_VENDING_MARGIN_CELLS,
  boothOverlapsPerimeterVendingLane,
  isPerimeterVendingLaneCell,
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

/**
 * Storefront side facing the 4′ perimeter concourse (row 0 = south wall).
 * Equipment depth extends toward the hall interior.
 */
export function storefrontSideForPerimeterWall(wall: PerimeterWall): StorefrontSide {
  switch (wall) {
    case 'south':
      return 'top'
    case 'north':
      return 'bottom'
    case 'west':
      return 'left'
    case 'east':
      return 'right'
  }
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

export interface PerimeterPlacementCandidate {
  colSpan: number
  rowSpan: number
  orientation: TableOrientation
  storefront: StorefrontSide
}

/** Wall-parallel spans + storefront facing the perimeter concourse at (row,col). */
export function perimeterPlacementAtOrigin(
  row: number,
  col: number,
  tableLengthFt: number,
  rows: number,
  cols: number
): PerimeterPlacementCandidate | null {
  const { colSpan, rowSpan } = lockedPerimeterSpansAtOrigin(row, col, tableLengthFt, rows, cols)
  const walls = touchingPerimeterWalls(row, col, rowSpan, colSpan, rows, cols)
  if (walls.length === 0) return null
  const storefront = storefrontSideForPerimeterWall(pickPrimaryPerimeterWall(walls))
  return {
    colSpan,
    rowSpan,
    orientation: tableOrientationForStorefront(storefront),
    storefront,
  }
}

/** Snap origin so the booth back sits on the inner edge of the 4′ vending margin. */
export function alignOriginToPerimeterWall(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): { row: number; col: number } {
  const m = PERIMETER_VENDING_MARGIN_CELLS
  if (rows <= m * 2 + 1 || cols <= m * 2 + 1) return { row, col }

  const walls = touchingPerimeterWalls(row, col, rowSpan, colSpan, rows, cols)
  if (walls.length === 0) return { row, col }

  let r = row
  let c = col
  const primary = pickPrimaryPerimeterWall(walls)

  // Leave row/col 1 as walkable concourse; booth backs sit one cell in from the outer shell.
  const concoursePad = 1
  if (primary === 'south' && walls.includes('south')) {
    r = concoursePad + 1
  } else if (primary === 'north' && walls.includes('north')) {
    r = Math.max(concoursePad + 1, rows - 1 - m - rowSpan + 1 - concoursePad)
  } else if (primary === 'west' && walls.includes('west')) {
    c = concoursePad + 1
  } else if (primary === 'east' && walls.includes('east')) {
    c = Math.max(concoursePad + 1, cols - 1 - m - colSpan + 1 - concoursePad)
  }

  return { row: r, col: c }
}

/** True when the storefront side opens onto the perimeter concourse or a doorway. */
export function boothStorefrontFacesPerimeterConcourse(
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  storefront: StorefrontSide,
  rows: number,
  cols: number,
  walkway: Set<string>,
  wallKeys: Set<string>
): boolean {
  const neighbors = sideCellsForStorefront(r0, c0, r1, c1, storefront)
  if (neighbors.length === 0) return false

  for (const { row, col } of neighbors) {
    if (row < 0 || col < 0 || row >= rows || col >= cols) continue
    const key = cellKey(row, col)
    if (walkway.has(key)) continue
    if (wallKeys.has(key)) return false
    if (isPerimeterVendingLaneCell(row, col, cols, rows)) continue
    return false
  }
  return true
}

function sideCellsForStorefront(
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  side: StorefrontSide
): { row: number; col: number }[] {
  const cells: { row: number; col: number }[] = []
  if (side === 'top') {
    for (let c = c0; c <= c1; c++) cells.push({ row: r0 - 1, col: c })
  } else if (side === 'bottom') {
    for (let c = c0; c <= c1; c++) cells.push({ row: r1 + 1, col: c })
  } else if (side === 'left') {
    for (let r = r0; r <= r1; r++) cells.push({ row: r, col: c0 - 1 })
  } else {
    for (let r = r0; r <= r1; r++) cells.push({ row: r, col: c1 + 1 })
  }
  return cells
}
