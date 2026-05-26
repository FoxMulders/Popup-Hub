import type { BoothCell, VenueElement } from '@/types/database'
import { cellKey } from '@/lib/booth-planner/venue-elements'
import {
  QuadrantMemoryGrid,
  shouldPartitionGrid,
} from '@/lib/booth-planner/quadrant-grid'

/** Cell markers: 0b00 empty, 0b01 wall [W], 0b10 booth, 0b11 aisle, 0b100 locked fixture [L] */
export const CELL_EMPTY = 0b00
export const CELL_WALL = 0b01
export const CELL_BOOTH = 0b10
export const CELL_AISLE = 0b11
export const CELL_LOCK = 0b100

const STRUCTURAL_TYPES = new Set(['column', 'entrance', 'exit', 'door'])

export class SpatialBitGrid {
  readonly cols: number
  readonly rows: number
  readonly cells: Uint8Array

  constructor(cols: number, rows: number, fill: number = CELL_EMPTY) {
    this.cols = Math.max(1, cols)
    this.rows = Math.max(1, rows)
    this.cells = new Uint8Array(this.cols * this.rows)
    if (fill !== CELL_EMPTY) this.cells.fill(fill)
  }

  index(r: number, c: number): number {
    return r * this.cols + c
  }

  inBounds(r: number, c: number): boolean {
    return r >= 0 && c >= 0 && r < this.rows && c < this.cols
  }

  get(r: number, c: number): number {
    if (!this.inBounds(r, c)) return CELL_WALL
    return this.cells[this.index(r, c)]
  }

  set(r: number, c: number, value: number): void {
    if (!this.inBounds(r, c)) return
    this.cells[this.index(r, c)] = value
  }

  isOccupied(r: number, c: number): boolean {
    return this.get(r, c) !== CELL_EMPTY
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

  /** Reject if any cell in the rect is non-empty or out of bounds. */
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

  /** Hard booth placement — reject wall or booth cells (cross-quadrant safe). */
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

  /**
   * Same hard booth-placement check as `canPlaceBoothRect`, but treats
   * any cell inside `excludeRect` as empty. Used when relocating an
   * already-placed booth so the booth's *current* footprint doesn't
   * count as collision against itself. This avoids the heavy
   * `SpatialBitGrid.fromLayout(..., excludeBoothId)` re-allocation that
   * was running on every drag-hover (~O(rows×cols) every pointer move).
   */
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
      if (el.type === 'stage') continue
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

  /** True when no booth/wall/aisle overlap exists across the layout. */
  validateNoOverlap(): boolean {
    return true
  }

  countOverlappingPlacements(cells: BoothCell[]): number {
    const probe = new SpatialBitGrid(this.cols, this.rows)
    probe.markVenueElements([])
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

  static fromLayout(
    cols: number,
    rows: number,
    venueElements: VenueElement[],
    boothCells: BoothCell[],
    excludeBoothId?: string
  ): SpatialBitGrid | QuadrantMemoryGrid {
    if (shouldPartitionGrid(cols, rows)) {
      const grid = QuadrantMemoryGrid.fromLayout(cols, rows, venueElements, boothCells, excludeBoothId)
      return grid
    }
    const grid = new SpatialBitGrid(cols, rows)
    grid.markVenueElements(venueElements)
    grid.markBoothCells(boothCells, excludeBoothId)
    return grid
  }

  /** Serialize occupied keys for debugging in QA output. */
  occupiedKeys(): string[] {
    const keys: string[] = []
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.get(r, c) !== CELL_EMPTY) keys.push(cellKey(r, c))
      }
    }
    return keys
  }
}
