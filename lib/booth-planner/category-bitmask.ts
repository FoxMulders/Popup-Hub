import type { BoothCell } from '@/types/database'
import { normalizeCategoryKey } from '@/lib/booth-planner/category-isolation'
import {
  quadrantBoundsForGrid,
  type QuadrantId,
} from '@/lib/booth-planner/quadrant-grid'

/** Maps category keys to 1–255 slot ids stored in the per-cell bitmask. */
export class CategorySlotRegistry {
  private readonly keyToSlot = new Map<string, number>()
  private nextSlot = 1

  slotFor(categoryKey: string): number {
    const existing = this.keyToSlot.get(categoryKey)
    if (existing != null) return existing
    const slot = this.nextSlot >= 255 ? 255 : this.nextSlot++
    this.keyToSlot.set(categoryKey, slot)
    return slot
  }
}

function indexFor(cols: number, r: number, c: number): number {
  return r * cols + c
}

function insideRect(
  r: number,
  c: number,
  rect: { row: number; col: number; rowSpan: number; colSpan: number }
): boolean {
  return (
    r >= rect.row &&
    r < rect.row + rect.rowSpan &&
    c >= rect.col &&
    c < rect.col + rect.colSpan
  )
}

function quadrantForCell(r: number, c: number, cols: number, rows: number): QuadrantId {
  const midC = Math.floor(cols / 2)
  const midR = Math.floor(rows / 2)
  if (r < midR) return c < midC ? 'nw' : 'ne'
  return c < midC ? 'sw' : 'se'
}

/** Orthogonal neighbors one cell outside a booth rectangle. */
export function boothEdgeNeighborCells(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): Array<[number, number]> {
  const neighbors: Array<[number, number]> = []
  const seen = new Set<string>()

  const add = (r: number, c: number) => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return
    const key = `${r}-${c}`
    if (seen.has(key)) return
    seen.add(key)
    neighbors.push([r, c])
  }

  for (let c = col; c < col + colSpan; c++) {
    add(row - 1, c)
    add(row + rowSpan, c)
  }
  for (let r = row; r < row + rowSpan; r++) {
    add(r, col - 1)
    add(r, col + colSpan)
  }

  return neighbors
}

/**
 * Per-cell category slot grid (Uint8Array). Slot 0 = empty; 1–255 = category bucket.
 * Pairs with CategorySpatialIndex (quadtree) for distance/quadrant scoring.
 */
export class CategoryBitmaskGrid {
  readonly cols: number
  readonly rows: number
  readonly slots: CategorySlotRegistry
  readonly cells: Uint8Array

  constructor(cols: number, rows: number, slots = new CategorySlotRegistry()) {
    this.cols = Math.max(1, cols)
    this.rows = Math.max(1, rows)
    this.slots = slots
    this.cells = new Uint8Array(this.cols * this.rows)
  }

  get(r: number, c: number): number {
    if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return 0
    return this.cells[indexFor(this.cols, r, c)]
  }

  set(r: number, c: number, slot: number): void {
    if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return
    this.cells[indexFor(this.cols, r, c)] = slot
  }

  markBooth(cell: Pick<BoothCell, 'row' | 'col' | 'rowSpan' | 'colSpan' | 'categoryName'>, categoryKey?: string): void {
    if (cell.col < 0 || cell.row < 0) return
    const key = categoryKey ?? normalizeCategoryKey(cell.categoryName)
    const slot = this.slots.slotFor(key)
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
        this.set(r, c, slot)
      }
    }
  }

  clearBooth(cell: Pick<BoothCell, 'row' | 'col' | 'rowSpan' | 'colSpan'>): void {
    if (cell.col < 0 || cell.row < 0) return
    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
        this.set(r, c, 0)
      }
    }
  }

  /** True when any edge-adjacent cell carries the same category slot. */
  touchesSameCategory(
    categoryKey: string,
    row: number,
    col: number,
    rowSpan: number,
    colSpan: number,
    excludeRect?: { row: number; col: number; rowSpan: number; colSpan: number }
  ): boolean {
    const slot = this.slots.slotFor(categoryKey)
    if (slot === 0) return false

    for (const [r, c] of boothEdgeNeighborCells(row, col, rowSpan, colSpan, this.rows, this.cols)) {
      if (excludeRect && insideRect(r, c, excludeRect)) continue
      if (this.get(r, c) === slot) return true
    }
    return false
  }

  occupiedQuadrantsForCategory(categoryKey: string): Set<QuadrantId> {
    const slot = this.slots.slotFor(categoryKey)
    const occupied = new Set<QuadrantId>()
    if (slot === 0) return occupied

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (this.get(r, c) !== slot) continue
        occupied.add(quadrantForCell(r, c, this.cols, this.rows))
      }
    }
    return occupied
  }

  static fromPlacedCells(
    cols: number,
    rows: number,
    cells: BoothCell[],
    excludeBoothId?: string
  ): CategoryBitmaskGrid {
    const grid = new CategoryBitmaskGrid(cols, rows)
    for (const cell of cells) {
      if (cell.col < 0 || cell.row < 0) continue
      if (excludeBoothId && cell.id === excludeBoothId) continue
      grid.markBooth(cell)
    }
    return grid
  }
}

export { quadrantBoundsForGrid, quadrantForCell }
