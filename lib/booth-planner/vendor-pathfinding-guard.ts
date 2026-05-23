import type { BoothCell, LayoutSpacingMode, VenueElement } from '@/types/database'
import { frontAisleRectForStorefront, type FrontSide } from '@/lib/booth-planner/co-generated-aisles'
import {
  buildWalkabilityGrid,
  computePatronPathTrace,
  patronPathFlowVectorAt,
  type PatronPathTrace,
} from '@/lib/booth-planner/patron-path-trace'
import { cellKey } from '@/lib/booth-planner/venue-elements'
import { isTentVendor } from '@/lib/booth-planner/vendor-unit-types'
import {
  resolveVendorPersonaFootprint,
  vendorFootprintMismatch,
} from '@/lib/booth-planner/vendor-footprint'

export interface VendorPathfindingGuardInput {
  rows: number
  cols: number
  venueElements: VenueElement[]
  entrance: 'north' | 'south' | 'east' | 'west'
  placedCells: BoothCell[]
  candidate: BoothCell
  excludeBoothId?: string
  spacingMode: LayoutSpacingMode
  baselineTableLengthFt?: number
  storefront?: FrontSide | null
}

export interface VendorPathfindingGuardResult {
  ok: boolean
  reason?: 'no_patron_path' | 'storefront_blocked' | 'flow_vector_blocked'
}

/** Re-apply locked vendor table footprints so walkability math uses true 5′–10′ spans. */
export function normalizePlacedCellsForPathfinding(
  cells: BoothCell[],
  spacingMode: LayoutSpacingMode,
  options?: { baselineTableLengthFt?: number }
): BoothCell[] {
  return cells.map((cell) => {
    if (cell.col < 0 || cell.row < 0 || isTentVendor(cell.vendorUnitType)) return cell
    if (!vendorFootprintMismatch(cell, spacingMode, options)) return cell
    const locked = resolveVendorPersonaFootprint(cell, spacingMode, options)
    return {
      ...cell,
      colSpan: locked.colSpan,
      rowSpan: locked.rowSpan,
      tableLengthFt: locked.tableLengthFt ?? cell.tableLengthFt,
    }
  })
}

function mergePlacedWithCandidate(input: VendorPathfindingGuardInput): BoothCell[] {
  const { placedCells, candidate, excludeBoothId, spacingMode, baselineTableLengthFt } = input
  const normalized = normalizePlacedCellsForPathfinding(placedCells, spacingMode, {
    baselineTableLengthFt,
  }).filter((c) => c.col >= 0 && c.row >= 0 && c.id !== excludeBoothId)

  const locked = resolveVendorPersonaFootprint(candidate, spacingMode, { baselineTableLengthFt })
  const probe: BoothCell = {
    ...candidate,
    tableLengthFt: locked.tableLengthFt ?? candidate.tableLengthFt,
  }

  return [...normalized, probe]
}

function storefrontWalkable(
  walkable: boolean[][],
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  storefront: FrontSide,
  rows: number,
  cols: number
): boolean {
  const aisle = frontAisleRectForStorefront(row, col, rowSpan, colSpan, storefront)
  if (!aisle) return false

  for (let r = aisle.row; r < aisle.row + aisle.rowSpan; r++) {
    for (let c = aisle.col; c < aisle.col + aisle.colSpan; c++) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) return false
      if (!walkable[r][c]) return false
    }
  }
  return true
}

/** True when patron path segments near the candidate retain a non-zero flow direction. */
function flowVectorsUnobstructedNearBooth(
  trace: PatronPathTrace,
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  maxRadiusCells = 6
): boolean {
  const centerR = row + rowSpan / 2
  const centerC = col + colSpan / 2
  let checked = 0

  for (let r = Math.max(0, Math.floor(centerR - maxRadiusCells)); r <= Math.floor(centerR + maxRadiusCells); r++) {
    for (let c = Math.max(0, Math.floor(centerC - maxRadiusCells)); c <= Math.floor(centerC + maxRadiusCells); c++) {
      const dr = r - centerR
      const dc = c - centerC
      if (dr * dr + dc * dc > maxRadiusCells * maxRadiusCells) continue
      const flow = patronPathFlowVectorAt(r, c, trace)
      if (!flow) continue
      checked += 1
      const mag = Math.hypot(flow.dr, flow.dc)
      if (mag < 1e-6) return false
    }
  }

  return checked > 0
}

/**
 * Validate vendor placement using locked footprints so pathfinding vectors stay mathematically
 * consistent with 5′–10′ table equipment spans.
 */
export function vendorPathfindingUnobstructed(
  input: VendorPathfindingGuardInput
): VendorPathfindingGuardResult {
  const { rows, cols, venueElements, entrance, storefront } = input
  const nextPlaced = mergePlacedWithCandidate(input)

  const trace = computePatronPathTrace(venueElements, cols, rows, entrance, {
    placedCells: nextPlaced,
  })
  if (!trace || trace.points.length < 2) {
    return { ok: false, reason: 'no_patron_path' }
  }

  const walkable = buildWalkabilityGrid(rows, cols, venueElements, nextPlaced)
  const { row, col, rowSpan, colSpan } = nextPlaced[nextPlaced.length - 1]!

  if (storefront && !isTentVendor(input.candidate.vendorUnitType)) {
    if (!storefrontWalkable(walkable, row, col, rowSpan, colSpan, storefront, rows, cols)) {
      return { ok: false, reason: 'storefront_blocked' }
    }
  }

  if (!flowVectorsUnobstructedNearBooth(trace, row, col, rowSpan, colSpan)) {
    return { ok: false, reason: 'flow_vector_blocked' }
  }

  return { ok: true }
}

export function vendorPathfindingBlockMessage(reason?: VendorPathfindingGuardResult['reason']): string {
  switch (reason) {
    case 'no_patron_path':
      return 'Cannot place here — would block the main patron path.'
    case 'storefront_blocked':
      return 'Cannot place here — storefront aisle must stay walkable.'
    case 'flow_vector_blocked':
      return 'Cannot place here — would obstruct patron flow vectors.'
    default:
      return 'Cannot place here — blocked or occupied.'
  }
}

/** Walkability keys occupied by a vendor probe (core + safety buffer). */
export function vendorPathfindingOccupiedKeys(
  cell: Pick<BoothCell, 'row' | 'col' | 'rowSpan' | 'colSpan'>,
  bufferCells = 2
): Set<string> {
  const keys = new Set<string>()
  const { row, col, rowSpan, colSpan } = cell
  for (let r = row - bufferCells; r < row + rowSpan + bufferCells; r++) {
    for (let c = col - bufferCells; c < col + colSpan + bufferCells; c++) {
      keys.add(cellKey(r, c))
    }
  }
  return keys
}
