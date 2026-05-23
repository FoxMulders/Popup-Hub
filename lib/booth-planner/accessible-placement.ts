import type { BoothCell, VenueElement, VenueElementType } from '@/types/database'
import { cellKey } from '@/lib/booth-planner/venue-elements'
import { PERIMETER_VENDING_MARGIN_CELLS, isOuterPerimeterCell } from '@/lib/booth-planner/perimeter-clearance'
import { boothClearanceRingViolates } from '@/lib/booth-planner/booth-edge-clearance'
import { placementViolatesStrollerSeparation } from '@/lib/booth-planner/stroller-clearance'
import type { CategorySpatialIndex } from '@/lib/booth-planner/category-quadtree'
import { categoryIsolationScore } from '@/lib/booth-planner/category-isolation'
import type { StorefrontSide } from '@/lib/booth-planner/aisle-orientation'
import { clearanceRingEmpty } from '@/lib/booth-planner/co-generated-aisles'
import { BOOTH_SAFETY_BUFFER_CELLS } from '@/lib/booth-planner/layout-clearance-constants'

const WALKWAY_TYPES: Set<VenueElementType> = new Set([
  'aisle',
  'entrance',
  'door',
  'exit',
])

/** Max connected booth footprint in grid cells (prevents trapped interior blocks). */
export const MAX_CLUSTER_WIDTH_CELLS = 2
export const MAX_CLUSTER_HEIGHT_CELLS = 2

export const AUTO_PLAN_CAPACITY_TOAST =
  '⚠️ Room capacity reached. Some booths could not be placed while maintaining mandatory 8ft stroller-safe aisles.'

export function buildWalkwayCells(elements: VenueElement[]): Set<string> {
  const walkway = new Set<string>()
  for (const el of elements) {
    if (!WALKWAY_TYPES.has(el.type)) continue
    const spanC = el.colSpan ?? 1
    const spanR = el.rowSpan ?? 1
    for (let r = el.row; r < el.row + spanR; r++) {
      for (let c = el.col; c < el.col + spanC; c++) {
        walkway.add(cellKey(r, c))
      }
    }
  }
  return walkway
}

type BoothRect = { r0: number; c0: number; r1: number; c1: number }

function sideCells(r0: number, c0: number, r1: number, c1: number, side: 'top' | 'bottom' | 'left' | 'right') {
  const cells: { r: number; c: number }[] = []
  if (side === 'top') {
    for (let c = c0; c <= c1; c++) cells.push({ r: r0 - 1, c })
  } else if (side === 'bottom') {
    for (let c = c0; c <= c1; c++) cells.push({ r: r1 + 1, c })
  } else if (side === 'left') {
    for (let r = r0; r <= r1; r++) cells.push({ r, c: c0 - 1 })
  } else {
    for (let r = r0; r <= r1; r++) cells.push({ r, c: c1 + 1 })
  }
  return cells
}

/** True when every cell along a booth side borders a walkway tile. */
function sideTouchesWalkway(
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  side: 'top' | 'bottom' | 'left' | 'right',
  rows: number,
  cols: number,
  walkway: Set<string>
): boolean {
  const neighbors = sideCells(r0, c0, r1, c1, side)
  if (neighbors.length === 0) return false
  return neighbors.every(
    ({ r, c }) => r >= 0 && r < rows && c >= 0 && c < cols && walkway.has(cellKey(r, c))
  )
}

/** Mandatory aisle-frontage: at least one full side faces aisle / entrance / exit. */
export function boothHasAisleFrontage(
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  rows: number,
  cols: number,
  walkway: Set<string>
): boolean {
  return (
    sideTouchesWalkway(r0, c0, r1, c1, 'top', rows, cols, walkway) ||
    sideTouchesWalkway(r0, c0, r1, c1, 'bottom', rows, cols, walkway) ||
    sideTouchesWalkway(r0, c0, r1, c1, 'left', rows, cols, walkway) ||
    sideTouchesWalkway(r0, c0, r1, c1, 'right', rows, cols, walkway)
  )
}

/** Storefront side must fully border walkway; other sides must not be the only walkway touch. */
export function boothStorefrontFacesWalkway(
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
  if (!sideTouchesWalkway(r0, c0, r1, c1, storefront, rows, cols, walkway)) return false

  const neighbors = sideCells(r0, c0, r1, c1, storefront)
  for (const { r, c } of neighbors) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return false
    if (wallKeys.has(cellKey(r, c))) return false
    if (isOuterPerimeterCell(r, c, cols, rows) && !walkway.has(cellKey(r, c))) {
      return false
    }
  }
  return true
}

/** Booth faces the inner vendor ring or perimeter walkway (wall-space priority for auto-plan). */
export function isWallSpacePlacement(
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  rows: number,
  cols: number,
  walkway: Set<string>
): boolean {
  const d = PERIMETER_VENDING_MARGIN_CELLS
  for (let c = c0; c <= c1; c++) {
    if (r0 > 0 && walkway.has(cellKey(r0 - 1, c)) && r0 - 1 === 0) return true
    if (r1 < rows - 1 && walkway.has(cellKey(r1 + 1, c)) && r1 + 1 === rows - 1) return true
    if (r0 >= 1 && r0 <= d) return true
    if (r1 >= rows - 1 - d && r1 <= rows - 2) return true
  }
  for (let r = r0; r <= r1; r++) {
    if (c0 > 0 && walkway.has(cellKey(r, c0 - 1)) && c0 - 1 === 0) return true
    if (c1 < cols - 1 && walkway.has(cellKey(r, c1 + 1)) && c1 + 1 === cols - 1) return true
    if (c0 >= 1 && c0 <= d) return true
    if (c1 >= cols - 1 - d && c1 <= cols - 2) return true
  }
  return false
}

function floodComponent(
  start: { r: number; c: number },
  occupied: Set<string>
): { minR: number; maxR: number; minC: number; maxC: number; keys: Set<string> } {
  const stack = [start]
  const keys = new Set<string>()
  let minR = start.r
  let maxR = start.r
  let minC = start.c
  let maxC = start.c

  while (stack.length > 0) {
    const { r, c } = stack.pop()!
    const k = cellKey(r, c)
    if (!occupied.has(k) || keys.has(k)) continue
    keys.add(k)
    minR = Math.min(minR, r)
    maxR = Math.max(maxR, r)
    minC = Math.min(minC, c)
    maxC = Math.max(maxC, c)
    stack.push(
      { r: r - 1, c },
      { r: r + 1, c },
      { r, c: c - 1 },
      { r, c: c + 1 }
    )
  }

  return { minR, maxR, minC, maxC, keys }
}

function rectIntersectsComponent(
  rect: BoothRect,
  keys: Set<string>
): boolean {
  for (let r = rect.r0; r <= rect.r1; r++) {
    for (let c = rect.c0; c <= rect.c1; c++) {
      if (keys.has(cellKey(r, c))) return true
    }
  }
  return false
}

/** Reject merges into multi-booth islands wider or taller than 2×2 cells (single large booths are OK). */
export function clusterWithinLimit(
  boothRects: BoothRect[],
  candidate: BoothRect,
  maxW = MAX_CLUSTER_WIDTH_CELLS,
  maxH = MAX_CLUSTER_HEIGHT_CELLS
): boolean {
  const allRects = [...boothRects, candidate]
  const occupied = new Set<string>()
  for (const rect of allRects) {
    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) {
        occupied.add(cellKey(r, c))
      }
    }
  }

  const visited = new Set<string>()
  for (const k of occupied) {
    if (visited.has(k)) continue
    const [r, c] = k.split('-').map(Number)
    const { minR, maxR, minC, maxC, keys } = floodComponent({ r, c }, occupied)
    for (const kk of keys) visited.add(kk)

    const rectsInComponent = allRects.filter((rect) => rectIntersectsComponent(rect, keys))
    if (rectsInComponent.length <= 1) continue

    const width = maxC - minC + 1
    const height = maxR - minR + 1
    if (width > maxW || height > maxH) return false
  }
  return true
}

export type PlacementGrid = ('empty' | 'blocked' | 'occupied')[][]

export interface PlacementContext {
  rows: number
  cols: number
  grid: PlacementGrid
  walkway: Set<string>
  boothRects: BoothRect[]
  boothWidthFt: number
  boothLengthFt: number
  /** Perimeter wall cells — reject storefront facing walls. */
  wallKeys?: Set<string>
  /** When set, require strict storefront-on-aisle placement. */
  strictStorefront?: StorefrontSide
  /** When false, skip uniform 2′ clearance ring check (painted corridor aisles are source of truth). */
  requireClearanceRing?: boolean
  /** When true, painted aisles provide separation — allow adjacent booth rows along an aisle. */
  skipStrollerSeparation?: boolean
  /** When true, allow dense corridor packing (aisles enforce flow). */
  skipClusterLimit?: boolean
  /** Stair landings + exit keep-out — booth core may not occupy these cells. */
  placementForbidden?: Set<string>
}

export function canPlaceAccessible(
  ctx: PlacementContext,
  startRow: number,
  startCol: number,
  rowSpan: number,
  colSpan: number
): boolean {
  const { rows, cols, grid, walkway, boothRects, boothWidthFt, boothLengthFt, wallKeys, strictStorefront, skipStrollerSeparation, skipClusterLimit } = ctx

  if (startRow < 0 || startCol < 0 || startRow + rowSpan > rows || startCol + colSpan > cols) {
    return false
  }

  for (let r = startRow; r < startRow + rowSpan; r++) {
    for (let c = startCol; c < startCol + colSpan; c++) {
      if (grid[r][c] !== 'empty') return false
      if (ctx.placementForbidden?.has(cellKey(r, c))) return false
    }
  }

  if (skipStrollerSeparation) {
    if (
      placementViolatesStrollerSeparation(
        boothRects,
        startRow,
        startCol,
        rowSpan,
        colSpan,
        boothWidthFt,
        boothLengthFt,
        1,
        1
      )
    ) {
      return false
    }
  } else if (
    boothClearanceRingViolates(
      grid,
      startRow,
      startCol,
      rowSpan,
      colSpan,
      BOOTH_SAFETY_BUFFER_CELLS,
      walkway
    )
  ) {
    return false
  }

  const r0 = startRow
  const c0 = startCol
  const r1 = startRow + rowSpan - 1
  const c1 = startCol + colSpan - 1

  if (strictStorefront && wallKeys) {
    if (
      !boothStorefrontFacesWalkway(r0, c0, r1, c1, strictStorefront, rows, cols, walkway, wallKeys)
    ) {
      return false
    }
  } else if (!boothHasAisleFrontage(r0, c0, r1, c1, rows, cols, walkway)) {
    return false
  }

  if (ctx.requireClearanceRing !== false && !boothClearanceRingValid(ctx, startRow, startCol, rowSpan, colSpan)) {
    return false
  }

  const candidate: BoothRect = { r0, c0, r1, c1 }
  if (!skipClusterLimit && !clusterWithinLimit(boothRects, candidate)) {
    return false
  }

  return true
}

function boothClearanceRingValid(
  ctx: PlacementContext,
  startRow: number,
  startCol: number,
  rowSpan: number,
  colSpan: number
): boolean {
  return clearanceRingEmpty(ctx, startRow, startCol, rowSpan, colSpan, BOOTH_SAFETY_BUFFER_CELLS)
}

export interface ScoredSlot {
  row: number
  col: number
  score: number
}

export interface SlotScoringOptions {
  categoryKey?: string
  categoryIndex?: CategorySpatialIndex
  /** Extra score from flow / power routing alignment. */
  bonusScore?: (row: number, col: number, rowSpan: number, colSpan: number) => number
  /** When true, skip this origin (e.g. category adjacency cap). */
  rejectSlot?: (row: number, col: number, colSpan: number) => boolean
}

/** Build candidate origins: wall rows first, then interior rows with aisle frontage. */
export function buildAccessiblePlacementSlots(
  ctx: PlacementContext,
  rowSpan: number,
  colSpan: number,
  placementOrder: [number, number][],
  preferWall: boolean,
  scoring?: SlotScoringOptions,
  iterationBudget?: { tick(): boolean }
): ScoredSlot[] {
  const orderIndex = new Map<string, number>()
  for (let i = 0; i < placementOrder.length; i++) {
    const [r, c] = placementOrder[i]
    orderIndex.set(cellKey(r, c), i)
  }

  const slots: ScoredSlot[] = []
  const forceWallOnly = ctx.cols <= 2 || ctx.rows <= 2

  for (let i = 0; i < placementOrder.length; i++) {
    if (iterationBudget?.tick()) break
    const row = placementOrder[i][0]
    const col = placementOrder[i][1]
    if (!canPlaceAccessible(ctx, row, col, rowSpan, colSpan)) continue
    if (scoring?.rejectSlot?.(row, col, colSpan)) continue

    const r1 = row + rowSpan - 1
    const c1 = col + colSpan - 1
    const wall = isWallSpacePlacement(row, col, r1, c1, ctx.rows, ctx.cols, ctx.walkway)
    if (forceWallOnly && !wall) continue
    const idx = orderIndex.get(cellKey(row, col)) ?? 99999

    let score = 10000 - idx
    if (preferWall && wall) score += 50000
    else if (!preferWall && !wall) score += 1000

    if (scoring?.categoryKey && scoring.categoryIndex) {
      score += categoryIsolationScore(row, col, rowSpan, colSpan, {
        categoryKey: scoring.categoryKey,
        index: scoring.categoryIndex,
      })
    }

    if (scoring?.bonusScore) {
      score += scoring.bonusScore(row, col, rowSpan, colSpan)
    }

    slots.push({ row, col, score })
  }

  slots.sort((a, b) => b.score - a.score)
  return slots
}

/** After placement, verify every placed booth still has aisle frontage (safety net). */
export function allPlacedBoothsAccessible(
  cells: BoothCell[],
  rows: number,
  cols: number,
  walkway: Set<string>
): boolean {
  for (const cell of cells) {
    if (cell.col < 0 || cell.row < 0) continue
    const r0 = cell.row
    const c0 = cell.col
    const r1 = cell.row + cell.rowSpan - 1
    const c1 = cell.col + cell.colSpan - 1
    if (!boothHasAisleFrontage(r0, c0, r1, c1, rows, cols, walkway)) return false
  }
  return true
}
