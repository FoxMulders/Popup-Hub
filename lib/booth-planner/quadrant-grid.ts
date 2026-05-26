import type { BoothCell, VenueElement } from '@/types/database'
import {
  CELL_EMPTY,
  CELL_WALL,
  CELL_BOOTH,
  CELL_AISLE,
  CELL_LOCK,
} from '@/lib/booth-planner/spatial-bitmap'

/** Venues above this sq ft (1′ grid cells) use quadrant memory partitioning. */
export const QUADRANT_PARTITION_SQ_FT = 10_000

export type QuadrantId = 'nw' | 'ne' | 'sw' | 'se'

export interface QuadrantBounds {
  id: QuadrantId
  col0: number
  col1: number
  row0: number
  row1: number
}

export interface ViewportRect {
  scrollLeft: number
  scrollTop: number
  clientWidth: number
  clientHeight: number
}

const STRUCTURAL_TYPES = new Set(['column', 'entrance', 'exit', 'door'])

export function shouldPartitionGrid(cols: number, rows: number): boolean {
  return cols * rows > QUADRANT_PARTITION_SQ_FT
}

export function quadrantBoundsForGrid(cols: number, rows: number): QuadrantBounds[] {
  const midC = Math.floor(cols / 2)
  const midR = Math.floor(rows / 2)
  return [
    { id: 'nw', col0: 0, col1: midC - 1, row0: 0, row1: midR - 1 },
    { id: 'ne', col0: midC, col1: cols - 1, row0: 0, row1: midR - 1 },
    { id: 'sw', col0: 0, col1: midC - 1, row0: midR, row1: rows - 1 },
    { id: 'se', col0: midC, col1: cols - 1, row0: midR, row1: rows - 1 },
  ]
}

function quadrantForCell(c: number, r: number, bounds: QuadrantBounds[]): QuadrantId {
  for (const b of bounds) {
    if (c >= b.col0 && c <= b.col1 && r >= b.row0 && r <= b.row1) return b.id
  }
  return 'se'
}

function localIndex(b: QuadrantBounds, r: number, c: number, cols: number): number {
  return (r - b.row0) * (b.col1 - b.col0 + 1) + (c - b.col0)
}

/** Four isolated Uint8Array sub-grids for large-venue memory efficiency. */
export class QuadrantMemoryGrid {
  readonly cols: number
  readonly rows: number
  readonly bounds: QuadrantBounds[]
  private stores: Map<QuadrantId, Uint8Array>

  constructor(cols: number, rows: number) {
    this.cols = Math.max(1, cols)
    this.rows = Math.max(1, rows)
    this.bounds = quadrantBoundsForGrid(this.cols, this.rows)
    this.stores = new Map()
    for (const b of this.bounds) {
      const w = b.col1 - b.col0 + 1
      const h = b.row1 - b.row0 + 1
      this.stores.set(b.id, new Uint8Array(w * h))
    }
  }

  inBounds(r: number, c: number): boolean {
    return r >= 0 && c >= 0 && r < this.rows && c < this.cols
  }

  get(r: number, c: number): number {
    if (!this.inBounds(r, c)) return CELL_WALL
    const b = this.bounds.find(
      (q) => c >= q.col0 && c <= q.col1 && r >= q.row0 && r <= q.row1
    )
    if (!b) return CELL_WALL
    const store = this.stores.get(b.id)!
    return store[localIndex(b, r, c, this.cols)]
  }

  set(r: number, c: number, value: number): void {
    if (!this.inBounds(r, c)) return
    const b = this.bounds.find(
      (q) => c >= q.col0 && c <= q.col1 && r >= q.row0 && r <= q.row1
    )
    if (!b) return
    const store = this.stores.get(b.id)!
    store[localIndex(b, r, c, this.cols)] = value
  }

  fillRect(
    col: number,
    row: number,
    colSpan: number,
    rowSpan: number,
    value: number,
    overwriteEmptyOnly = true
  ): void {
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        if (!this.inBounds(r, c)) continue
        if (overwriteEmptyOnly && this.get(r, c) !== CELL_EMPTY) continue
        this.set(r, c, value)
      }
    }
  }

  /** Cross-quadrant seam safe — rejects if any cell in rect is occupied. */
  canPlaceRect(col: number, row: number, colSpan: number, rowSpan: number): boolean {
    if (col < 0 || row < 0 || col + colSpan > this.cols || row + rowSpan > this.rows) {
      return false
    }
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        if (this.get(r, c) !== CELL_EMPTY) return false
      }
    }
    return true
  }

  /** Hard booth placement — reject wall or booth cells across quadrant seams. */
  canPlaceBoothRect(col: number, row: number, colSpan: number, rowSpan: number): boolean {
    if (col < 0 || row < 0 || col + colSpan > this.cols || row + rowSpan > this.rows) {
      return false
    }
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        const code = this.get(r, c)
        if (code === CELL_WALL || code === CELL_BOOTH || code === CELL_LOCK) return false
      }
    }
    return true
  }

  /** See SpatialBitGrid.canPlaceBoothRectExcluding. */
  canPlaceBoothRectExcluding(
    col: number,
    row: number,
    colSpan: number,
    rowSpan: number,
    excludeRect?: { row: number; col: number; rowSpan: number; colSpan: number }
  ): boolean {
    if (col < 0 || row < 0 || col + colSpan > this.cols || row + rowSpan > this.rows) {
      return false
    }
    const er = excludeRect
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        if (
          er &&
          r >= er.row &&
          r < er.row + er.rowSpan &&
          c >= er.col &&
          c < er.col + er.colSpan
        ) {
          continue
        }
        const code = this.get(r, c)
        if (code === CELL_WALL || code === CELL_BOOTH || code === CELL_LOCK) return false
      }
    }
    return true
  }

  markVenueElements(elements: VenueElement[]): void {
    for (const el of elements) {
      const spanC = el.colSpan ?? 1
      const spanR = el.rowSpan ?? 1
      if (el.type === 'entrance' || el.type === 'exit' || el.type === 'door') continue
      let marker: number
      if (el.type === 'aisle') {
        marker = CELL_AISLE
      } else if (el.locked && el.type !== 'column') {
        marker = CELL_LOCK
      } else {
        marker = CELL_WALL
      }
      this.fillRect(el.col, el.row, spanC, spanR, marker, false)
    }
  }

  markBoothCells(cells: BoothCell[], excludeId?: string): void {
    for (const cell of cells) {
      if (cell.col < 0 || cell.row < 0) continue
      if (excludeId && cell.id === excludeId) continue
      this.fillRect(cell.col, cell.row, cell.colSpan, cell.rowSpan, CELL_BOOTH, false)
    }
  }

  static fromLayout(
    cols: number,
    rows: number,
    venueElements: VenueElement[],
    boothCells: BoothCell[],
    excludeBoothId?: string
  ): QuadrantMemoryGrid {
    const grid = new QuadrantMemoryGrid(cols, rows)
    grid.markVenueElements(venueElements)
    grid.markBoothCells(boothCells, excludeBoothId)
    return grid
  }

  countOverlappingPlacements(cells: BoothCell[]): number {
    const probe = new QuadrantMemoryGrid(this.cols, this.rows)
    let overlaps = 0
    for (const cell of cells) {
      if (cell.col < 0 || cell.row < 0) continue
      if (!probe.canPlaceRect(cell.col, cell.row, cell.colSpan, cell.rowSpan)) {
        overlaps++
      }
      probe.fillRect(cell.col, cell.row, cell.colSpan, cell.rowSpan, CELL_BOOTH, false)
    }
    return overlaps
  }

  /** Quadrants intersecting the scroll viewport (occlusion culling). */
  visibleQuadrants(viewport: ViewportRect, cellPx: number): QuadrantId[] {
    const pad = cellPx * 2
    const vCol0 = Math.max(0, Math.floor((viewport.scrollLeft - pad) / cellPx))
    const vCol1 = Math.min(
      this.cols - 1,
      Math.ceil((viewport.scrollLeft + viewport.clientWidth + pad) / cellPx)
    )
    const vRow0 = Math.max(0, Math.floor((viewport.scrollTop - pad) / cellPx))
    const vRow1 = Math.min(
      this.rows - 1,
      Math.ceil((viewport.scrollTop + viewport.clientHeight + pad) / cellPx)
    )

    const visible = new Set<QuadrantId>()
    for (let r = vRow0; r <= vRow1; r++) {
      for (let c = vCol0; c <= vCol1; c++) {
        visible.add(quadrantForCell(c, r, this.bounds))
      }
    }
    return Array.from(visible)
  }
}
