import type { BoothCell, VenueElement } from '@/types/database'
import { cellKey } from '@/lib/booth-planner/venue-elements'
import { allPlacedBoothsAccessible, buildWalkwayCells } from '@/lib/booth-planner/accessible-placement'

export interface LayoutValidationResult {
  valid: boolean
  violations: string[]
}

/** Ensure no booth overlaps fixtures, other booths, or lacks aisle frontage. */
export function validateAutoLayoutPlacement(input: {
  cells: BoothCell[]
  rows: number
  cols: number
  blocked: Set<string>
  venueElements: VenueElement[]
}): LayoutValidationResult {
  const { cells, rows, cols, blocked, venueElements } = input
  const violations: string[] = []
  const walkway = buildWalkwayCells(venueElements)
  const occupancy = new Map<string, string>()

  for (const cell of cells) {
    if (cell.col < 0 || cell.row < 0) continue

    for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
      for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) {
          violations.push(`Booth ${cell.vendorName} extends outside grid at ${r},${c}`)
          continue
        }
        const key = cellKey(r, c)
        if (blocked.has(key)) {
          violations.push(`Booth ${cell.vendorName} overlaps fixture/aisle at ${key}`)
        }
        const prev = occupancy.get(key)
        if (prev && prev !== cell.id) {
          violations.push(`Booth ${cell.vendorName} overlaps another booth at ${key}`)
        }
        occupancy.set(key, cell.id)
      }
    }
  }

  if (!allPlacedBoothsAccessible(cells, rows, cols, walkway)) {
    violations.push('One or more booths lack mandatory aisle frontage')
  }

  return { valid: violations.length === 0, violations }
}
