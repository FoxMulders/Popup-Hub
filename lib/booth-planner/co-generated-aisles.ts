import type { VenueElement } from '@/types/database'
import { buildExpoStyleDoorwaysOnly } from '@/lib/booth-planner/expo-floor-shell'
import { cellKey } from '@/lib/booth-planner/venue-elements'
import type { PlacementContext } from '@/lib/booth-planner/accessible-placement'
import { clusterWithinLimit } from '@/lib/booth-planner/accessible-placement'
import { placementViolatesStrollerSeparation } from '@/lib/booth-planner/stroller-clearance'
import {
  BOOTH_CORE_SEPARATION_CELLS,
  BOOTH_SAFETY_BUFFER_CELLS,
} from '@/lib/booth-planner/layout-clearance-constants'

/** @deprecated Use {@link BOOTH_SAFETY_BUFFER_CELLS} — kept for legacy imports. */
export const CO_GENERATED_AISLE_DEPTH_CELLS = BOOTH_SAFETY_BUFFER_CELLS

export type FrontSide = 'top' | 'bottom' | 'left' | 'right'

export interface AisleRect {
  row: number
  col: number
  rowSpan: number
  colSpan: number
}

/** Cells in the uniform safety buffer ring around a booth core. */
export function clearanceRingCells(
  boothRow: number,
  boothCol: number,
  rowSpan: number,
  colSpan: number,
  depthCells: number = BOOTH_SAFETY_BUFFER_CELLS
): { r: number; c: number }[] {
  const r0 = boothRow
  const c0 = boothCol
  const r1 = boothRow + rowSpan - 1
  const c1 = boothCol + colSpan - 1
  const ring = new Map<string, { r: number; c: number }>()

  const add = (r: number, c: number) => {
    if (r >= r0 && r <= r1 && c >= c0 && c <= c1) return
    ring.set(`${r}-${c}`, { r, c })
  }

  for (let d = 1; d <= depthCells; d++) {
    for (let c = c0; c <= c1; c++) {
      add(r0 - d, c)
      add(r1 + d, c)
    }
    for (let r = r0; r <= r1; r++) {
      add(r, c0 - d)
      add(r, c1 + d)
    }
  }

  return Array.from(ring.values())
}

export function clearanceRingInBounds(
  boothRow: number,
  boothCol: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number,
  depthCells: number = BOOTH_SAFETY_BUFFER_CELLS
): boolean {
  for (const { r, c } of clearanceRingCells(boothRow, boothCol, rowSpan, colSpan, depthCells)) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return false
  }
  return true
}

export function clearanceRingEmpty(
  ctx: PlacementContext,
  boothRow: number,
  boothCol: number,
  rowSpan: number,
  colSpan: number,
  depthCells: number = BOOTH_SAFETY_BUFFER_CELLS
): boolean {
  for (const { r, c } of clearanceRingCells(boothRow, boothCol, rowSpan, colSpan, depthCells)) {
    if (r < 0 || c < 0 || r >= ctx.rows || c >= ctx.cols) continue
    if (ctx.grid[r][c] !== 'empty' && !ctx.walkway.has(cellKey(r, c))) return false
  }
  return true
}

/** Booth fronts face the entrance wall — used for manual facing UI only. */
export function boothFrontSide(entrance: 'north' | 'south' | 'east' | 'west'): FrontSide {
  switch (entrance) {
    case 'south':
      return 'bottom'
    case 'north':
      return 'top'
    case 'west':
      return 'left'
    case 'east':
      return 'right'
  }
}

/** @deprecated Front-only aisle rects removed — use {@link clearanceRingCells}. */
export function frontAisleRectForStorefront(
  boothRow: number,
  boothCol: number,
  boothRowSpan: number,
  boothColSpan: number,
  side: FrontSide,
  depthCells: number = BOOTH_SAFETY_BUFFER_CELLS
): AisleRect | null {
  switch (side) {
    case 'bottom':
      return {
        row: boothRow + boothRowSpan,
        col: boothCol,
        rowSpan: depthCells,
        colSpan: boothColSpan,
      }
    case 'top':
      return {
        row: boothRow - depthCells,
        col: boothCol,
        rowSpan: depthCells,
        colSpan: boothColSpan,
      }
    case 'left':
      return {
        row: boothRow,
        col: boothCol - depthCells,
        rowSpan: boothRowSpan,
        colSpan: depthCells,
      }
    case 'right':
      return {
        row: boothRow,
        col: boothCol + boothColSpan,
        rowSpan: boothRowSpan,
        colSpan: depthCells,
      }
  }
}

/** @deprecated Front-only aisle rects removed — use {@link clearanceRingCells}. */
export function frontAisleRectForBooth(
  boothRow: number,
  boothCol: number,
  boothRowSpan: number,
  boothColSpan: number,
  entrance: 'north' | 'south' | 'east' | 'west',
  depthCells: number = BOOTH_SAFETY_BUFFER_CELLS
): AisleRect | null {
  return frontAisleRectForStorefront(
    boothRow,
    boothCol,
    boothRowSpan,
    boothColSpan,
    boothFrontSide(entrance),
    depthCells
  )
}

export function aisleRectInBounds(
  rect: AisleRect,
  rows: number,
  cols: number
): boolean {
  return (
    rect.row >= 0 &&
    rect.col >= 0 &&
    rect.row + rect.rowSpan <= rows &&
    rect.col + rect.colSpan <= cols
  )
}

export function aisleRectCells(rect: AisleRect): { r: number; c: number }[] {
  const out: { r: number; c: number }[] = []
  for (let r = rect.row; r < rect.row + rect.rowSpan; r++) {
    for (let c = rect.col; c < rect.col + rect.colSpan; c++) {
      out.push({ r, c })
    }
  }
  return out
}

export function canPlaceCoGeneratedUnit(
  ctx: PlacementContext,
  startRow: number,
  startCol: number,
  rowSpan: number,
  colSpan: number
): boolean {
  const { rows, cols, grid, boothRects, boothWidthFt, boothLengthFt } = ctx

  if (startRow < 0 || startCol < 0 || startRow + rowSpan > rows || startCol + colSpan > cols) {
    return false
  }

  for (let r = startRow; r < startRow + rowSpan; r++) {
    for (let c = startCol; c < startCol + colSpan; c++) {
      if (grid[r][c] !== 'empty') return false
      if (ctx.placementForbidden?.has(cellKey(r, c))) return false
      if (ctx.walkway.has(cellKey(r, c))) return false
    }
  }

  if (
    !ctx.skipStrollerSeparation &&
    placementViolatesStrollerSeparation(
      boothRects,
      startRow,
      startCol,
      rowSpan,
      colSpan,
      boothWidthFt,
      boothLengthFt,
      BOOTH_CORE_SEPARATION_CELLS,
      BOOTH_CORE_SEPARATION_CELLS
    )
  ) {
    return false
  }

  if (!ctx.skipStrollerSeparation && !clearanceRingEmpty(ctx, startRow, startCol, rowSpan, colSpan)) {
    return false
  }

  const r0 = startRow
  const c0 = startCol
  const r1 = startRow + rowSpan - 1
  const c1 = startCol + colSpan - 1
  const candidate = { r0, c0, r1, c1 }
  if (!clusterWithinLimit(boothRects, candidate)) {
    return false
  }

  return true
}

export function createCoGeneratedAisleElement(
  rect: AisleRect,
  boothNumber: number
): VenueElement {
  return {
    id: crypto.randomUUID(),
    type: 'aisle',
    row: rect.row,
    col: rect.col,
    rowSpan: rect.rowSpan,
    colSpan: rect.colSpan,
    locked: true,
    label: `Aisle · Booth ${boothNumber}`,
  }
}

/** Wide carved entrance + exit only — co-plan generates paired shopper aisles. */
export function buildEntranceExitOnlyElements(
  entrance: 'north' | 'south' | 'east' | 'west',
  cols: number,
  rows: number
): VenueElement[] {
  return buildExpoStyleDoorwaysOnly(entrance, cols, rows)
}

/** Keep interior fixtures; replace aisles with entrance/exit shell for co-plan. */
export function venueShellForCoPlan(
  existing: VenueElement[],
  entrance: 'north' | 'south' | 'east' | 'west',
  cols: number,
  rows: number
): VenueElement[] {
  const interior = existing.filter(
    (e) =>
      e.type !== 'aisle' &&
      e.type !== 'entrance' &&
      e.type !== 'exit' &&
      e.type !== 'door'
  )
  const presetDoors = existing.filter((e) => e.type === 'entrance' || e.type === 'exit')
  const hasEntrance = presetDoors.some((e) => e.type === 'entrance')
  const hasExit = presetDoors.some((e) => e.type === 'exit')
  const doors =
    hasEntrance && hasExit ? presetDoors : buildEntranceExitOnlyElements(entrance, cols, rows)
  return [...doors, ...interior]
}

export function registerCoGeneratedAisle(
  ctx: PlacementContext,
  rect: AisleRect,
  walkway: Set<string>
): void {
  for (const { r, c } of aisleRectCells(rect)) {
    ctx.grid[r][c] = 'blocked'
    walkway.add(cellKey(r, c))
  }
}

/** Drop paired aisle fixture when a booth moves or is removed. */
export function removeCoAisleForBooth(
  elements: VenueElement[],
  boothNumber: number
): VenueElement[] {
  const label = `Aisle · Booth ${boothNumber}`
  return elements.filter((e) => !(e.type === 'aisle' && e.label === label))
}

/** True when every cell in the clearance ring is unoccupied by booths or fixtures. */
export function manualCoAisleCellsAvailableForStorefront(
  boothRow: number,
  boothCol: number,
  rowSpan: number,
  colSpan: number,
  _storefront: FrontSide,
  rows: number,
  cols: number,
  blocked: Set<string>,
  cellMap: Map<string, { id: string }>,
  excludeBoothId?: string
): boolean {
  for (const { r, c } of clearanceRingCells(boothRow, boothCol, rowSpan, colSpan)) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return false
    if (blocked.has(cellKey(r, c))) return false
    const existing = cellMap.get(cellKey(r, c))
    if (existing && existing.id !== excludeBoothId) return false
  }
  return true
}

/** True when every cell in the clearance ring is unoccupied by booths or fixtures. */
export function manualCoAisleCellsAvailable(
  boothRow: number,
  boothCol: number,
  rowSpan: number,
  colSpan: number,
  _entrance: 'north' | 'south' | 'east' | 'west',
  rows: number,
  cols: number,
  blocked: Set<string>,
  cellMap: Map<string, { id: string }>,
  excludeBoothId?: string
): boolean {
  return manualCoAisleCellsAvailableForStorefront(
    boothRow,
    boothCol,
    rowSpan,
    colSpan,
    'bottom',
    rows,
    cols,
    blocked,
    cellMap,
    excludeBoothId
  )
}
