import type { TableOrientation } from '@/lib/booth-planner/table-orientation'
import {
  BOOTH_EQUIPMENT_DEPTH_FT,
} from '@/lib/booth-planner/table-space'
import { BOOTH_SAFETY_BUFFER_CELLS } from '@/lib/booth-planner/layout-clearance-constants'
import { cellKey } from '@/lib/booth-planner/venue-elements'
import { isOuterPerimeterCell } from '@/lib/booth-planner/perimeter-clearance'
import {
  collectOpeningCellKeys,
  virtualPerimeterWallCellKeys,
} from '@/lib/booth-planner/perimeter-clearance'
import type { VenueElement } from '@/types/database'

export type StorefrontSide = 'top' | 'bottom' | 'left' | 'right'

/** Flip storefront 180° (top↔bottom, left↔right). Used by Smart Populate auto-layout. */
export function invertStorefrontSide(side: StorefrontSide): StorefrontSide {
  switch (side) {
    case 'top':
      return 'bottom'
    case 'bottom':
      return 'top'
    case 'left':
      return 'right'
    case 'right':
      return 'left'
  }
}

export interface BoothOrientationCandidate {
  colSpan: number
  rowSpan: number
  orientation: TableOrientation
  storefront: StorefrontSide
}

function sideCells(
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

export function storefrontSideForOrientation(
  colSpan: number,
  rowSpan: number,
  orientation: TableOrientation
): StorefrontSide {
  if (orientation === 'horizontal') return 'bottom'
  return 'right'
}

function orientationCandidates(tableLengthFt: number): BoothOrientationCandidate[] {
  const L = Math.max(1, Math.round(tableLengthFt))
  return [
    {
      colSpan: L,
      rowSpan: BOOTH_EQUIPMENT_DEPTH_FT,
      orientation: 'horizontal',
      storefront: 'bottom',
    },
    {
      colSpan: BOOTH_EQUIPMENT_DEPTH_FT,
      rowSpan: L,
      orientation: 'vertical',
      storefront: 'right',
    },
  ]
}

function isWalkwayCell(
  row: number,
  col: number,
  walkway: Set<string>,
  rows: number,
  cols: number
): boolean {
  if (row < 0 || col < 0 || row >= rows || col >= cols) return false
  return walkway.has(cellKey(row, col))
}

function isBlockedStructuralCell(
  row: number,
  col: number,
  rows: number,
  cols: number,
  blockedWalls: Set<string>
): boolean {
  if (row < 0 || col < 0 || row >= rows || col >= cols) return true
  if (blockedWalls.has(cellKey(row, col))) return true
  if (isOuterPerimeterCell(row, col, cols, rows)) return true
  return false
}

function storefrontTouchesWalkway(
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  storefront: StorefrontSide,
  rows: number,
  cols: number,
  walkway: Set<string>
): boolean {
  const neighbors = sideCells(r0, c0, r1, c1, storefront)
  if (neighbors.length === 0) return false
  return neighbors.every(({ row, col }) => isWalkwayCell(row, col, walkway, rows, cols))
}

/** True when the designated storefront side points at a wall, column, or non-walkable dead cell. */
export function storefrontSideFacesWall(
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
  for (const { row, col } of sideCells(r0, c0, r1, c1, storefront)) {
    if (row < 0 || col < 0 || row >= rows || col >= cols) return true
    if (wallKeys.has(cellKey(row, col))) return true
    if (isOuterPerimeterCell(row, col, cols, rows) && !walkway.has(cellKey(row, col))) return true
  }
  return false
}

/** Storefront must address a painted aisle — not walls or dead space. */
export function storefrontAddressesAisle(
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
  if (storefrontSideFacesWall(r0, c0, r1, c1, storefront, rows, cols, walkway, wallKeys)) return false
  const neighbors = sideCells(r0, c0, r1, c1, storefront)
  if (neighbors.length === 0) return false
  return neighbors.some(({ row, col }) => isWalkwayCell(row, col, walkway, rows, cols))
}

function storefrontClearanceBandClear(
  r0: number,
  c0: number,
  r1: number,
  c1: number,
  _storefront: StorefrontSide,
  rows: number,
  cols: number,
  walkway: Set<string>,
  gridOccupied: (r: number, c: number) => boolean
): boolean {
  const depth = BOOTH_SAFETY_BUFFER_CELLS
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    for (let d = 1; d <= depth; d++) {
      for (const { row, col } of sideCells(r0, c0, r1, c1, side)) {
        let nr = row
        let nc = col
        switch (side) {
          case 'bottom':
            nr = row + d
            break
          case 'top':
            nr = row - d
            break
          case 'right':
            nc = col + d
            break
          case 'left':
            nc = col - d
            break
        }
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) return false
        if (gridOccupied(nr, nc) && !walkway.has(cellKey(nr, nc))) return false
      }
    }
  }
  return true
}

export function buildBlockedWallKeys(elements: VenueElement[], cols: number, rows: number): Set<string> {
  return virtualPerimeterWallCellKeys(cols, rows, collectOpeningCellKeys(elements))
}

/** Pick orientation where storefront faces walkway, not walls; prefer best sightline score. */
export function resolveBoothSpansForWalkway(
  row: number,
  col: number,
  tableLengthFt: number,
  rows: number,
  cols: number,
  walkway: Set<string>,
  wallKeys: Set<string>,
  gridOccupied: (r: number, c: number) => boolean,
  sightlineScore?: (storefront: StorefrontSide, colSpan: number, rowSpan: number) => number
): BoothOrientationCandidate | null {
  let best: (BoothOrientationCandidate & { score: number }) | null = null

  for (const candidate of orientationCandidates(tableLengthFt)) {
    const { colSpan, rowSpan, orientation, storefront } = candidate
    if (row + rowSpan > rows || col + colSpan > cols) continue

    let footprintBlocked = false
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        if (gridOccupied(r, c)) footprintBlocked = true
      }
    }
    if (footprintBlocked) continue

    const r0 = row
    const c0 = col
    const r1 = row + rowSpan - 1
    const c1 = col + colSpan - 1

    if (!storefrontTouchesWalkway(r0, c0, r1, c1, storefront, rows, cols, walkway)) continue

    const storefrontNeighbors = sideCells(r0, c0, r1, c1, storefront)
    if (
      storefrontNeighbors.some(({ row: nr, col: nc }) =>
        isBlockedStructuralCell(nr, nc, rows, cols, wallKeys)
      )
    ) {
      continue
    }

    if (
      !storefrontClearanceBandClear(
        r0,
        c0,
        r1,
        c1,
        storefront,
        rows,
        cols,
        walkway,
        gridOccupied
      )
    ) {
      continue
    }

    const score = sightlineScore?.(storefront, colSpan, rowSpan) ?? 0
    if (!best || score > best.score) {
      best = { ...candidate, score }
    }
  }

  return best
}

/** @deprecated Longest-edge frontage rule removed — storefront is a facing hint only. */
export function storefrontOnLongEdge(
  _storefront: StorefrontSide,
  _colSpan: number,
  _rowSpan: number
): boolean {
  return true
}

/** Score when table length runs parallel to patron flow (path-aligned row). */
export function tableLongAxisParallelToFlowScore(
  colSpan: number,
  rowSpan: number,
  flow: { dr: number; dc: number } | null
): number {
  if (!flow || (flow.dr === 0 && flow.dc === 0)) return 0
  const longAxisHorizontal = colSpan >= rowSpan
  const flowMostlyHorizontal = Math.abs(flow.dc) >= Math.abs(flow.dr)
  return longAxisHorizontal === flowMostlyHorizontal ? 1 : -1
}

/** Cosine similarity between storefront normal and flow vector; 1 = perfect forward discovery. */
export function sightlineAlignmentScore(
  storefront: StorefrontSide,
  flow: { dr: number; dc: number } | null
): number {
  if (!flow || (flow.dr === 0 && flow.dc === 0)) return 0
  let sx = 0
  let sy = 0
  switch (storefront) {
    case 'bottom':
      sy = 1
      break
    case 'top':
      sy = -1
      break
    case 'right':
      sx = 1
      break
    case 'left':
      sx = -1
      break
  }
  const mag = Math.hypot(flow.dr, flow.dc)
  if (mag === 0) return 0
  const dot = sx * flow.dc + sy * flow.dr
  return dot / mag
}
