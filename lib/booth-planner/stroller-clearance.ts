import type { BoothCell, VenueElement, VenueElementType } from '@/types/database'
import { buildVenueElementMap, cellKey } from '@/lib/booth-planner/venue-elements'
import { hallHasIndoorShell } from '@/lib/booth-planner/indoor-shell'
import { MIN_STROLLER_AISLE_WIDTH_FT } from '@/lib/booth-planner/layout-clearance-constants'

export { MIN_STROLLER_AISLE_WIDTH_FT } from '@/lib/booth-planner/layout-clearance-constants'

const WALKWAY_TYPES: Set<VenueElementType> = new Set([
  'aisle',
  'entrance',
  'door',
  'exit',
])

export interface StrollerClearanceInput {
  rows: number
  cols: number
  boothWidthFt: number
  boothLengthFt: number
  cells: BoothCell[]
  venueElements: VenueElement[]
}

export interface StrollerClearanceResult {
  bottleneckKeys: Set<string>
  hasBottleneck: boolean
}

export function minBoothSeparationCells(boothWidthFt: number, boothLengthFt: number): {
  minCols: number
  minRows: number
} {
  return {
    minCols: Math.max(1, Math.ceil(MIN_STROLLER_AISLE_WIDTH_FT / boothWidthFt)),
    minRows: Math.max(1, Math.ceil(MIN_STROLLER_AISLE_WIDTH_FT / boothLengthFt)),
  }
}

/** Analyze grid for walkways narrower than 8ft (painted aisles + booth-compressed gaps). */
export function analyzeStrollerClearance(input: StrollerClearanceInput): StrollerClearanceResult {
  const { rows, cols, boothWidthFt, boothLengthFt, cells, venueElements } = input
  const bottleneckKeys = new Set<string>()

  if (rows === 0 || cols === 0) {
    return { bottleneckKeys, hasBottleneck: false }
  }

  const boothOccupied = buildBoothOccupancy(cells, rows, cols)
  const fixtureMap = buildVenueElementMap(venueElements)
  const paintedAislesOnly = usesPaintedCorridorWalkability(venueElements, cols, rows)

  if (paintedAislesOnly) {
    flagBoothsBlockingPaintedAisles(cells, fixtureMap, rows, cols, bottleneckKeys)
    return { bottleneckKeys, hasBottleneck: bottleneckKeys.size > 0 }
  }

  const walkable = buildWalkability(rows, cols, boothOccupied, fixtureMap, false)

  flagNarrowPaintedAisles(venueElements, boothWidthFt, boothLengthFt, bottleneckKeys)
  flagNarrowCorridors(walkable, boothWidthFt, boothLengthFt, bottleneckKeys)

  return { bottleneckKeys, hasBottleneck: bottleneckKeys.size > 0 }
}

function buildBoothOccupancy(
  cells: BoothCell[],
  rows: number,
  cols: number
): boolean[][] {
  const grid = Array.from({ length: rows }, () => Array(cols).fill(false))
  for (const cell of cells) {
    if (cell.col < 0 || cell.row < 0) continue
    for (let r = cell.row; r < cell.row + cell.rowSpan && r < rows; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan && c < cols; c++) {
        grid[r][c] = true
      }
    }
  }
  return grid
}

function buildWalkability(
  rows: number,
  cols: number,
  boothOccupied: boolean[][],
  fixtureMap: Map<string, VenueElement>,
  paintedAislesOnly: boolean
): boolean[][] {
  const walkable = Array.from({ length: rows }, () => Array(cols).fill(false))
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (boothOccupied[r][c]) continue
      const fixture = fixtureMap.get(cellKey(r, c))
      if (!fixture) {
        walkable[r][c] = !paintedAislesOnly
        continue
      }
      if (WALKWAY_TYPES.has(fixture.type)) {
        walkable[r][c] = true
      }
    }
  }
  return walkable
}

function hasStructuredAisleNetwork(venueElements: VenueElement[]): boolean {
  return venueElements.some(
    (e) =>
      e.type === 'aisle' &&
      (e.label === 'Row aisle' ||
        e.label === 'Shared aisle' ||
        e.label === 'Customer spine aisle')
  )
}

function usesPaintedCorridorWalkability(
  venueElements: VenueElement[],
  cols: number,
  rows: number
): boolean {
  if (!hallHasIndoorShell(venueElements, cols, rows)) return false
  const paintedAisles = venueElements.filter((e) => e.type === 'aisle').length
  if (paintedAisles >= 12) return true
  // Corridor / row-aisle grammar — skip flood-fill on open floor (false positives).
  return hasStructuredAisleNetwork(venueElements)
}

function flagBoothsBlockingPaintedAisles(
  cells: BoothCell[],
  fixtureMap: Map<string, VenueElement>,
  rows: number,
  cols: number,
  out: Set<string>
) {
  for (const cell of cells) {
    if (cell.col < 0 || cell.row < 0) continue
    for (let r = cell.row; r < cell.row + cell.rowSpan && r < rows; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan && c < cols; c++) {
        const fixture = fixtureMap.get(cellKey(r, c))
        if (fixture && WALKWAY_TYPES.has(fixture.type)) {
          out.add(cellKey(r, c))
        }
      }
    }
  }
}

function flagNarrowPaintedAisles(
  elements: VenueElement[],
  boothWidthFt: number,
  boothLengthFt: number,
  out: Set<string>
) {
  for (const el of elements) {
    if (el.type !== 'aisle') continue
    const spanC = el.colSpan ?? 1
    const spanR = el.rowSpan ?? 1
    const widthFtCol = spanC * boothWidthFt
    const widthFtRow = spanR * boothLengthFt
    const narrowFt = Math.min(widthFtCol, widthFtRow)
    if (narrowFt >= MIN_STROLLER_AISLE_WIDTH_FT) continue
    for (let r = el.row; r < el.row + spanR; r++) {
      for (let c = el.col; c < el.col + spanC; c++) {
        out.add(cellKey(r, c))
      }
    }
  }
}

/** Horizontal runs (walk east-west): thickness = contiguous walkable rows × boothLengthFt. */
function flagNarrowCorridors(
  walkable: boolean[][],
  boothWidthFt: number,
  boothLengthFt: number,
  out: Set<string>
) {
  const rows = walkable.length
  const cols = walkable[0]?.length ?? 0

  for (let r = 0; r < rows; r++) {
    let c = 0
    while (c < cols) {
      if (!walkable[r][c]) {
        c++
        continue
      }
      const startC = c
      while (c < cols && walkable[r][c]) c++
      const endC = c - 1
      if (endC - startC + 1 < 2) continue

      let thickness = 0
      for (let rr = r; rr < rows; rr++) {
        let full = true
        for (let cc = startC; cc <= endC; cc++) {
          if (!walkable[rr][cc]) {
            full = false
            break
          }
        }
        if (!full) break
        thickness++
      }
      const widthFt = thickness * boothLengthFt
      if (widthFt < MIN_STROLLER_AISLE_WIDTH_FT) {
        for (let rr = r; rr < r + thickness; rr++) {
          for (let cc = startC; cc <= endC; cc++) {
            out.add(cellKey(rr, cc))
          }
        }
      }
    }
  }

  for (let c = 0; c < cols; c++) {
    let r = 0
    while (r < rows) {
      if (!walkable[r][c]) {
        r++
        continue
      }
      const startR = r
      while (r < rows && walkable[r][c]) r++
      const endR = r - 1
      if (endR - startR + 1 < 2) continue

      let thickness = 0
      for (let cc = c; cc < cols; cc++) {
        let full = true
        for (let rr = startR; rr <= endR; rr++) {
          if (!walkable[rr][cc]) {
            full = false
            break
          }
        }
        if (!full) break
        thickness++
      }
      const widthFt = thickness * boothWidthFt
      if (widthFt < MIN_STROLLER_AISLE_WIDTH_FT) {
        for (let cc = c; cc < c + thickness; cc++) {
          for (let rr = startR; rr <= endR; rr++) {
            out.add(cellKey(rr, cc))
          }
        }
      }
    }
  }
}

type OccupancyGrid = ('empty' | 'blocked' | 'occupied')[][]

/** Auto-plan: reject placements that leave less than 8ft gap between booth footprints. */
export function boothsViolateStrollerSeparation(
  grid: OccupancyGrid,
  startRow: number,
  startCol: number,
  rowSpan: number,
  colSpan: number,
  boothWidthFt: number,
  boothLengthFt: number
): boolean {
  const { minCols, minRows } = minBoothSeparationCells(boothWidthFt, boothLengthFt)
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const newR0 = startRow
  const newR1 = startRow + rowSpan - 1
  const newC0 = startCol
  const newC1 = startCol + colSpan - 1

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== 'occupied') continue
      const otherR0 = r
      const otherR1 = r
      const otherC0 = c
      const otherC1 = c

      // Expand to full booth origin — grid marks all cells occupied; use cell as 1×1 proxy
      // Find booth bounds by scanning is expensive; use separation from cell to new rect
      const rowGap =
        newR1 < otherR0
          ? otherR0 - newR1 - 1
          : otherR1 < newR0
            ? newR0 - otherR1 - 1
            : -1
      const colGap =
        newC1 < otherC0
          ? otherC0 - newC1 - 1
          : otherC1 < newC0
            ? newC0 - otherC1 - 1
            : -1

      const rowsOverlap = !(newR1 < otherR0 || otherR1 < newR0)
      const colsOverlap = !(newC1 < otherC0 || otherC1 < newC0)

      if (rowsOverlap && colsOverlap) continue

      if (rowsOverlap && colGap >= 0 && colGap < minCols) return true
      if (colsOverlap && rowGap >= 0 && rowGap < minRows) return true
    }
  }
  return false
}

/** Build occupancy grid with full booth rectangles for separation checks. */
export function buildOccupancyWithBoothRects(
  rows: number,
  cols: number,
  blocked: Set<string>,
  placedCells: BoothCell[]
): { grid: OccupancyGrid; boothRects: { r0: number; c0: number; r1: number; c1: number }[] } {
  const grid: OccupancyGrid = Array.from({ length: rows }, () =>
    Array(cols).fill('empty')
  )
  for (const key of blocked) {
    const [r, c] = key.split('-').map(Number)
    if (r >= 0 && r < rows && c >= 0 && c < cols) grid[r][c] = 'blocked'
  }

  const boothRects: { r0: number; c0: number; r1: number; c1: number }[] = []
  for (const cell of placedCells) {
    if (cell.col < 0) continue
    boothRects.push({
      r0: cell.row,
      c0: cell.col,
      r1: cell.row + cell.rowSpan - 1,
      c1: cell.col + cell.colSpan - 1,
    })
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
        if (r < rows && c < cols && grid[r][c] === 'empty') grid[r][c] = 'occupied'
      }
    }
  }
  return { grid, boothRects }
}

export function placementViolatesStrollerSeparation(
  boothRects: { r0: number; c0: number; r1: number; c1: number }[],
  startRow: number,
  startCol: number,
  rowSpan: number,
  colSpan: number,
  boothWidthFt: number,
  boothLengthFt: number,
  minColsOverride?: number,
  minRowsOverride?: number
): boolean {
  const defaults = minBoothSeparationCells(boothWidthFt, boothLengthFt)
  const minCols = minColsOverride ?? defaults.minCols
  const minRows = minRowsOverride ?? defaults.minRows
  const newR0 = startRow
  const newR1 = startRow + rowSpan - 1
  const newC0 = startCol
  const newC1 = startCol + colSpan - 1

  for (const b of boothRects) {
    const rowGap =
      newR1 < b.r0 ? b.r0 - newR1 - 1 : b.r1 < newR0 ? newR0 - b.r1 - 1 : -1
    const colGap =
      newC1 < b.c0 ? b.c0 - newC1 - 1 : b.c1 < newC0 ? newC0 - b.c1 - 1 : -1
    const rowsOverlap = !(newR1 < b.r0 || b.r1 < newR0)
    const colsOverlap = !(newC1 < b.c0 || b.c1 < newC0)
    if (rowsOverlap && colsOverlap) continue
    if (rowsOverlap && colGap >= 0 && colGap < minCols) return true
    if (colsOverlap && rowGap >= 0 && rowGap < minRows) return true
  }
  return false
}
