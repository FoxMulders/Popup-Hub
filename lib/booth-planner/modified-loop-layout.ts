/**
 * Modified Loop layout — IKEA-style guided serpentine with retail psychology rules.
 *
 * Rule mapping (see inline docs on each export):
 *  1. Entrance buffer (15′) — no vendor compression at door
 *  2. Serpentine loop — continuous path visiting every booth before exit
 *  3. Anchor dead zones — stage/food/restroom pulled to deepest corners
 *  4. Category scattering — VendorPlacementGuard (no same-category adjacency)
 *  5. Right-hand bias — premium tier scored toward entrance-right clockwise arc
 *  6. Sightline hierarchy — low-profile center aisles, tall displays on perimeter
 */
import type { BoothCell, VenueElement } from '@/types/database'
import type { WallSide } from '@/lib/booth-planner/venue-elements'
import {
  isCoGeneratedBoothAisle,
  isImmutableVenueElement,
} from '@/lib/booth-planner/venue-elements'
import { cellsOfElement } from '@/lib/booth-planner/perimeter-clearance'
import {
  buildIndoorCorridorShell,
  computeInteriorBounds,
  indoorCorridorOriginsForBooth,
  isIndoorCorridorPlacement,
  type InteriorBounds,
} from '@/lib/booth-planner/indoor-corridor-layout'
import { computePatronPathTrace, type PatronPathTrace } from '@/lib/booth-planner/patron-path-trace'
import { findVenueAnchors, type VenueAnchor } from '@/lib/booth-planner/venue-anchors'
import { normalizeCategoryKey } from '@/lib/booth-planner/category-isolation'
import { VendorPlacementGuard } from '@/lib/booth-planner/vendor-placement-guards'
import type { StorefrontSide } from '@/lib/booth-planner/aisle-orientation'

/** Rule 1 — orientation zone depth from entrance (1′ grid cells). */
export const ENTRANCE_ORIENTATION_BUFFER_CELLS = 15

/** Rule 2 — main serpentine artery width (1′ cells). */
export const MODIFIED_LOOP_MAIN_AISLE_CELLS = 10

/** Rule 2 — side branch aisle width (1′ cells). */
export const MODIFIED_LOOP_SIDE_AISLE_CELLS = 8

/** Rule 6 — max table depth in center spine (low profile). */
export const CENTER_AISLE_MAX_ROW_SPAN = 6

/** Rule 6 — min span on perimeter wall ring (tall backdrop). */
export const PERIMETER_MIN_ROW_SPAN = 8

export type VendorTier = 'premium' | 'standard' | 'basic'

/** Smart Populate vendor input (maps from approved applications). */
export interface ModifiedLoopVendor {
  id: string
  name: string
  category: string
  categoryId?: string | null
  tier: VendorTier
  /** Grid footprint when 1′ spacing mode is active. */
  boothDimensions: { colSpan: number; rowSpan: number }
  categoryColor?: string
}

export interface ModifiedLoopLayoutPatch {
  venue_elements: VenueElement[]
  cells: BoothCell[]
}

export interface ModifiedLoopPatronPath {
  /** Ordered grid waypoints entrance → every vendor zone → exit. */
  waypoints: { row: number; col: number }[]
  trace: PatronPathTrace | null
}

function newId(): string {
  return crypto.randomUUID()
}

function aisleCell(row: number, col: number, label?: string): VenueElement {
  return {
    id: newId(),
    type: 'aisle',
    row,
    col,
    colSpan: 1,
    rowSpan: 1,
    label,
    locked: true,
  }
}

function blockedSet(elements: VenueElement[], cols: number, rows: number): Set<string> {
  const keys = new Set<string>()
  for (const el of elements) {
    if (el.type === 'stage') continue
    for (const { row, col } of cellsOfElement(el)) {
      if (row >= 0 && row < rows && col >= 0 && col < cols) keys.add(`${row}-${col}`)
    }
  }
  return keys
}

function preserveShell(elements: VenueElement[], cols: number, rows: number): VenueElement[] {
  return elements.filter((el) => {
    if (el.type === 'aisle') return false
    if (isCoGeneratedBoothAisle(el)) return false
    return isImmutableVenueElement(el, cols, rows)
  })
}

/**
 * Rule 1 — Paint a 15′ deep orientation band from the entrance inward.
 * Vendors must not occupy these cells (`inEntranceBufferZone`).
 */
export function paintEntranceOrientationBuffer(
  elements: VenueElement[],
  cols: number,
  rows: number,
  entrance: WallSide,
  existing: VenueElement[],
  skip: Set<string>
): void {
  const door = existing.find((e) => e.type === 'entrance')
  if (!door) return

  const spanC = door.colSpan ?? 1
  const spanR = door.rowSpan ?? 1
  const startCol = Math.max(0, door.col - Math.floor(ENTRANCE_ORIENTATION_BUFFER_CELLS / 2))
  const endCol = Math.min(cols - 1, door.col + spanC - 1 + Math.floor(ENTRANCE_ORIENTATION_BUFFER_CELLS / 2))

  const paintBand = (row: number) => {
    if (row < 0 || row >= rows) return
    for (let c = startCol; c <= endCol; c++) {
      if (skip.has(`${row}-${c}`)) continue
      elements.push(aisleCell(row, c, 'Entrance orientation'))
    }
  }

  if (entrance === 'south') {
    const base = door.row + spanR - 1
    for (let d = 0; d < ENTRANCE_ORIENTATION_BUFFER_CELLS; d++) paintBand(base + d)
  } else if (entrance === 'north') {
    const base = door.row
    for (let d = 0; d < ENTRANCE_ORIENTATION_BUFFER_CELLS; d++) paintBand(base - d)
  } else if (entrance === 'west') {
    const base = door.col + spanC - 1
    for (let d = 0; d < ENTRANCE_ORIENTATION_BUFFER_CELLS; d++) {
      const c = base + d
      if (c >= cols) continue
      for (let r = 0; r < rows; r++) {
        if (skip.has(`${r}-${c}`)) continue
        elements.push(aisleCell(r, c, 'Entrance orientation'))
      }
    }
  } else {
    const base = door.col
    for (let d = 0; d < ENTRANCE_ORIENTATION_BUFFER_CELLS; d++) {
      const c = base - d
      if (c < 0) continue
      for (let r = 0; r < rows; r++) {
        if (skip.has(`${r}-${c}`)) continue
        elements.push(aisleCell(r, c, 'Entrance orientation'))
      }
    }
  }
}

export function inEntranceBufferZone(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  cols: number,
  rows: number,
  entrance: WallSide,
  elements: VenueElement[]
): boolean {
  const door = elements.find((e) => e.type === 'entrance')
  if (!door) return false

  const r1 = row + rowSpan - 1
  const c1 = col + colSpan - 1

  if (entrance === 'south') {
    const threshold = door.row + (door.rowSpan ?? 1) - 1 + ENTRANCE_ORIENTATION_BUFFER_CELLS
    return r1 < threshold
  }
  if (entrance === 'north') {
    const threshold = door.row - ENTRANCE_ORIENTATION_BUFFER_CELLS
    return row > threshold
  }
  if (entrance === 'west') {
    const threshold = door.col + (door.colSpan ?? 1) - 1 + ENTRANCE_ORIENTATION_BUFFER_CELLS
    return c1 < threshold
  }
  const threshold = door.col - ENTRANCE_ORIENTATION_BUFFER_CELLS
  return col > threshold
}

/**
 * Rule 2 — Chamfer corner transitions (~45° sightline) by painting diagonal connector aisles
 * at the four interior hall corners instead of hard 90° turns.
 */
export function paintAngledCornerTransitions(
  elements: VenueElement[],
  bounds: InteriorBounds,
  skip: Set<string>
): void {
  const corners: { r: number; c: number; dr: number; dc: number }[] = [
    { r: bounds.minRow, c: bounds.minCol, dr: 1, dc: 1 },
    { r: bounds.minRow, c: bounds.maxCol, dr: 1, dc: -1 },
    { r: bounds.maxRow, c: bounds.minCol, dr: -1, dc: 1 },
    { r: bounds.maxRow, c: bounds.maxCol, dr: -1, dc: -1 },
  ]

  const chamferLen = Math.min(6, Math.floor((bounds.maxRow - bounds.minRow) / 4))
  for (const corner of corners) {
    for (let i = 1; i <= chamferLen; i++) {
      const r = corner.r + corner.dr * i
      const c = corner.c + corner.dc * i
      if (skip.has(`${r}-${c}`)) continue
      elements.push(aisleCell(r, c, 'Angled corner'))
    }
  }
}

/**
 * Rule 3 — Score dead-zone depth; anchors should sit at max Manhattan distance from entrance.
 * Returns corner centroid suggestions when anchors are missing from fixtures.
 */
export function detectDeadZoneCorners(
  cols: number,
  rows: number,
  entrance: WallSide,
  bounds: InteriorBounds
): { row: number; col: number; label: string }[] {
  const deep =
    entrance === 'south' || entrance === 'west'
      ? [
          { row: bounds.maxRow, col: bounds.maxCol, label: 'NE anchor zone' },
          { row: bounds.maxRow, col: bounds.minCol, label: 'NW anchor zone' },
        ]
      : [
          { row: bounds.minRow, col: bounds.maxCol, label: 'SE anchor zone' },
          { row: bounds.minRow, col: bounds.minCol, label: 'SW anchor zone' },
        ]
  return deep
}

export function suggestAnchorPlacements(
  elements: VenueElement[],
  cols: number,
  rows: number,
  entrance: WallSide
): VenueElement[] {
  const bounds = computeInteriorBounds(cols, rows)
  const existing = findVenueAnchors(elements)
  if (existing.length >= 2) return []

  const zones = detectDeadZoneCorners(cols, rows, entrance, bounds)
  const suggestions: VenueElement[] = []
  const types: VenueElement['type'][] = ['food_court', 'restroom', 'stage']

  zones.forEach((zone, i) => {
    if (existing.some((a) => Math.abs(a.centerRow - zone.row) < 8 && Math.abs(a.centerCol - zone.col) < 8)) {
      return
    }
    suggestions.push({
      id: newId(),
      type: types[i % types.length]!,
      row: zone.row - 2,
      col: zone.col - 2,
      rowSpan: 4,
      colSpan: 4,
      label: zone.label,
      locked: false,
    })
  })

  return suggestions
}

/**
 * Rule 5 — Clockwise bias: premium vendors score higher on the right arc leaving the entrance.
 * Math: project booth centroid into polar angle from entrance; reward angles in (0°, 180°) for
 * south entrance (patron turns right / counter-clockwise room traversal in US markets).
 */
export function scoreRightHandBias(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  tier: VendorTier,
  entrance: WallSide,
  cols: number,
  rows: number
): number {
  if (tier === 'basic') return 0
  const weight = tier === 'premium' ? 1 : 0.45

  const cr = row + rowSpan / 2
  const cc = col + colSpan / 2

  let entranceRow = 0
  let entranceCol = cols / 2
  switch (entrance) {
    case 'north':
      entranceRow = rows - 1
      entranceCol = cols / 2
      break
    case 'east':
      entranceCol = cols - 1
      entranceRow = rows / 2
      break
    case 'west':
      entranceCol = 0
      entranceRow = rows / 2
      break
    default:
      entranceRow = 0
      entranceCol = cols / 2
  }

  const dr = cr - entranceRow
  const dc = cc - entranceCol
  const angle = Math.atan2(dc, dr)

  // South entrance: right-hand arc is negative col delta (west side first when walking clockwise)
  let inRightArc = false
  switch (entrance) {
    case 'south':
      inRightArc = dc < 0
      break
    case 'north':
      inRightArc = dc > 0
      break
    case 'west':
      inRightArc = dr > 0
      break
    case 'east':
      inRightArc = dr < 0
      break
  }

  const proximity = 1 / (1 + Math.hypot(dr, dc) / Math.max(rows, cols))
  return inRightArc ? weight * 800 * proximity : weight * 120 * proximity
}

/**
 * Rule 6 — Center spine booths must stay low; perimeter booths may use full backdrop height.
 */
export function scoreSightlineHierarchy(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  bounds: InteriorBounds
): number {
  const onPerimeter =
    row <= bounds.minRow + 1 ||
    col <= bounds.minCol + 1 ||
    row + rowSpan >= bounds.maxRow ||
    col + colSpan >= bounds.maxCol

  if (onPerimeter) {
    return rowSpan >= PERIMETER_MIN_ROW_SPAN ? 400 : 150
  }

  if (rowSpan <= CENTER_AISLE_MAX_ROW_SPAN) return 350
  return -600
}

/** Rule 4 — Hard reject when same category touches or faces across aisle. */
export function rejectsCategoryScattering(
  guard: VendorPlacementGuard,
  categoryKey: string,
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number
): boolean {
  return guard.rejectsAutoPlacement({ categoryKey, row, col, rowSpan, colSpan })
}

export function isModifiedLoopPlacement(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  cols: number,
  rows: number,
  entrance: WallSide,
  elements: VenueElement[]
): boolean {
  if (!isIndoorCorridorPlacement(row, col, rowSpan, colSpan, cols, rows)) return false
  if (inEntranceBufferZone(row, col, rowSpan, colSpan, cols, rows, entrance, elements)) return false
  return true
}

/** Rule 2 — Serpentine slot order along indoor corridor grammar. */
export function buildModifiedLoopPlacementOrder(
  cols: number,
  rows: number,
  entrance: WallSide,
  elements: VenueElement[]
): [number, number][] {
  const origins = indoorCorridorOriginsForBooth(rows, cols, entrance, 8, 8)
  return origins.filter(([r, c]) => !inEntranceBufferZone(r, c, 8, 8, cols, rows, entrance, elements))
}

export function modifiedLoopOriginsForBooth(
  rows: number,
  cols: number,
  entrance: WallSide,
  rowSpan: number,
  colSpan: number,
  elements: VenueElement[]
): [number, number][] {
  const origins = indoorCorridorOriginsForBooth(rows, cols, entrance, rowSpan, colSpan)
  return origins.filter(
    ([r, c]) =>
      isModifiedLoopPlacement(r, c, rowSpan, colSpan, cols, rows, entrance, elements) &&
      !inEntranceBufferZone(r, c, rowSpan, colSpan, cols, rows, entrance, elements)
  )
}

export function computeModifiedLoopPatronPath(
  elements: VenueElement[],
  cols: number,
  rows: number,
  entrance: WallSide
): ModifiedLoopPatronPath {
  const trace = computePatronPathTrace(elements, cols, rows, entrance)
  const waypoints = trace?.points?.map((p) => ({ row: p.row, col: p.col })) ?? []
  return { waypoints, trace }
}

/** Paint corridor shell + orientation buffer + angled corners; optionally suggest anchors. */
export function applyModifiedLoopLayout(
  cols: number,
  rows: number,
  entrance: WallSide,
  existingElements: VenueElement[] = []
): ModifiedLoopLayoutPatch {
  const shell = preserveShell(existingElements, cols, rows)
  const corridorElements = buildIndoorCorridorShell(cols, rows, entrance, shell)
  const skip = blockedSet(corridorElements, cols, rows)
  const bounds = computeInteriorBounds(cols, rows)

  paintEntranceOrientationBuffer(corridorElements, cols, rows, entrance, shell, skip)
  paintAngledCornerTransitions(corridorElements, bounds, skip)

  return {
    venue_elements: corridorElements,
    cells: [],
  }
}

export function scoreModifiedLoopSlot(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  vendor: Pick<ModifiedLoopVendor, 'tier' | 'category' | 'categoryId'>,
  guard: VendorPlacementGuard,
  entrance: WallSide,
  cols: number,
  rows: number,
  bounds: InteriorBounds,
  flowBonus: number
): number {
  const categoryKey = normalizeCategoryKey(vendor.category, vendor.categoryId)
  if (rejectsCategoryScattering(guard, categoryKey, row, col, rowSpan, colSpan)) {
    return Number.NEGATIVE_INFINITY
  }

  return (
    guard.isolationScore({ categoryKey, row, col, rowSpan, colSpan }) +
    scoreRightHandBias(row, col, rowSpan, colSpan, vendor.tier, entrance, cols, rows) +
    scoreSightlineHierarchy(row, col, rowSpan, colSpan, bounds) +
    flowBonus
  )
}

/** Sort vendors: premium first (for right-hand slots), then interleave categories. */
export function sortModifiedLoopVendorQueue(vendors: ModifiedLoopVendor[]): ModifiedLoopVendor[] {
  const tierRank: Record<VendorTier, number> = { premium: 0, standard: 1, basic: 2 }
  return [...vendors].sort((a, b) => {
    const tr = tierRank[a.tier] - tierRank[b.tier]
    if (tr !== 0) return tr
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.name.localeCompare(b.name)
  })
}

export function tierFromApplicationMeta(input: {
  isFeatured?: boolean
  pricePerBooth?: number
  medianPrice?: number
}): VendorTier {
  if (input.isFeatured) return 'premium'
  if (
    input.pricePerBooth != null &&
    input.medianPrice != null &&
    input.pricePerBooth >= input.medianPrice * 1.25
  ) {
    return 'premium'
  }
  if (
    input.pricePerBooth != null &&
    input.medianPrice != null &&
    input.pricePerBooth <= input.medianPrice * 0.75
  ) {
    return 'basic'
  }
  return 'standard'
}

export function storefrontForModifiedLoop(
  colSpan: number,
  rowSpan: number,
  entrance: WallSide
): StorefrontSide {
  switch (entrance) {
    case 'south':
      return 'bottom'
    case 'north':
      return 'top'
    case 'west':
      return 'left'
    default:
      return 'right'
  }
}
