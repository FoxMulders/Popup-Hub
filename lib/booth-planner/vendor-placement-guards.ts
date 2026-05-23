import type { BoothCell } from '@/types/database'
import { CategoryBitmaskGrid, quadrantForCell } from '@/lib/booth-planner/category-bitmask'
import { CategorySpatialIndex } from '@/lib/booth-planner/category-quadtree'
import {
  categoryIsolationScore,
  normalizeCategoryKey,
} from '@/lib/booth-planner/category-isolation'
import type { QuadrantId } from '@/lib/booth-planner/quadrant-grid'

export interface VendorPlacementGuardInput {
  cols: number
  rows: number
  placedCells: BoothCell[]
  excludeBoothId?: string
}

export interface VendorPlacementCandidate {
  categoryKey: string
  row: number
  col: number
  rowSpan: number
  colSpan: number
  excludeRect?: { row: number; col: number; rowSpan: number; colSpan: number }
}

/**
 * Combines quadtree distance scoring with Uint8Array category bitmask adjacency checks
 * for vendor persona layout rules (auto-plan + manual drag).
 */
export class VendorPlacementGuard {
  readonly cols: number
  readonly rows: number
  readonly categoryIndex: CategorySpatialIndex
  readonly categoryBitmask: CategoryBitmaskGrid

  constructor(cols: number, rows: number) {
    this.cols = cols
    this.rows = rows
    this.categoryIndex = new CategorySpatialIndex(cols, rows)
    this.categoryBitmask = new CategoryBitmaskGrid(cols, rows)
  }

  static fromPlacedCells(input: VendorPlacementGuardInput): VendorPlacementGuard {
    const guard = new VendorPlacementGuard(input.cols, input.rows)
    for (const cell of input.placedCells) {
      if (cell.col < 0 || cell.row < 0) continue
      if (input.excludeBoothId && cell.id === input.excludeBoothId) continue
      const categoryKey = normalizeCategoryKey(cell.categoryName)
      guard.categoryIndex.insert(
        cell.row + cell.rowSpan / 2,
        cell.col + cell.colSpan / 2,
        categoryKey
      )
      guard.categoryBitmask.markBooth(cell, categoryKey)
    }
    return guard
  }

  markPlaced(cell: BoothCell, categoryKey?: string): void {
    if (cell.col < 0 || cell.row < 0) return
    const key = categoryKey ?? normalizeCategoryKey(cell.categoryName)
    this.categoryIndex.insert(cell.row + cell.rowSpan / 2, cell.col + cell.colSpan / 2, key)
    this.categoryBitmask.markBooth(cell, key)
  }

  /** Hard reject: same-category booth shares an edge with the candidate. */
  sameCategoryDirectlyAdjacent(candidate: VendorPlacementCandidate): boolean {
    return this.categoryBitmask.touchesSameCategory(
      candidate.categoryKey,
      candidate.row,
      candidate.col,
      candidate.rowSpan,
      candidate.colSpan,
      candidate.excludeRect
    )
  }

  /**
   * Reject when the candidate quadrant already holds this category but another quadrant is still open.
   * Keeps duplicate categories (Epoxy Resin, Amway, etc.) spread across Main Hall quadrants.
   */
  sameCategoryQuadrantCrowded(candidate: VendorPlacementCandidate): boolean {
    const occupied = this.categoryBitmask.occupiedQuadrantsForCategory(candidate.categoryKey)
    if (occupied.size === 0) return false
    if (occupied.size >= 4) return false

    const centerR = candidate.row + candidate.rowSpan / 2
    const centerC = candidate.col + candidate.colSpan / 2
    const candidateQuad = quadrantForCell(
      Math.floor(centerR),
      Math.floor(centerC),
      this.cols,
      this.rows
    ) as QuadrantId

    return occupied.has(candidateQuad)
  }

  /** Auto-plan slot rejection — no edge adjacency + prefer open quadrants. */
  rejectsAutoPlacement(candidate: VendorPlacementCandidate): boolean {
    return (
      this.sameCategoryDirectlyAdjacent(candidate) ||
      this.sameCategoryQuadrantCrowded(candidate)
    )
  }

  /** Manual vendor drag — block only hard edge adjacency (coordinator can override quadrant spread). */
  rejectsManualPlacement(candidate: VendorPlacementCandidate): boolean {
    return this.sameCategoryDirectlyAdjacent(candidate)
  }

  isolationScore(candidate: VendorPlacementCandidate): number {
    return categoryIsolationScore(
      candidate.row,
      candidate.col,
      candidate.rowSpan,
      candidate.colSpan,
      { categoryKey: candidate.categoryKey, index: this.categoryIndex }
    )
  }
}

export function buildVendorPlacementGuard(input: VendorPlacementGuardInput): VendorPlacementGuard {
  return VendorPlacementGuard.fromPlacedCells(input)
}

export function vendorCategoryIsolationMessage(categoryName: string): string {
  return `Cannot place ${categoryName} here — keep identical categories apart (different quadrants preferred).`
}

export function vendorCategoryAdjacencyMessage(categoryName: string): string {
  return `Cannot place ${categoryName} adjacent to another ${categoryName} booth.`
}
