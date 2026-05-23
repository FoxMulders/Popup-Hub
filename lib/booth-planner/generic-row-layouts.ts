/**
 * Generic auto-plan row templates — vertical columns, horizontal rows, and serpentine snake.
 * Preserves immutable venue shell; paints 2′+2′ shared aisle corridors on the 1′ grid.
 */
import type { BoothCell, VenueElement } from '@/types/database'
import type { WallSide } from '@/lib/booth-planner/venue-elements'
import {
  isCoGeneratedBoothAisle,
  isImmutableVenueElement,
} from '@/lib/booth-planner/venue-elements'
import { cellsOfElement } from '@/lib/booth-planner/perimeter-clearance'
import type { StorefrontSide } from '@/lib/booth-planner/aisle-orientation'
import {
  computeInteriorBounds,
  CORRIDOR_AISLE_WIDTH_CELLS,
  CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS,
  CORRIDOR_THRESHOLD_BUFFER_CELLS,
  buildIndoorCorridorShell,
  indoorCorridorFlowVectorAt,
  indoorCorridorOriginsForBooth,
  isIndoorCorridorPlacement,
  type InteriorBounds,
} from '@/lib/booth-planner/indoor-corridor-layout'
import {
  BACK_TO_BACK_PAIR_STRIDE_CELLS,
  BOOTH_ROW_DEPTH_CELLS,
  isBackToBackVendorRow,
  isSharedAisleRow,
  preferredStorefrontForSharedStrip,
  sharedAisleRowsToPaint,
  sharedAisleStripAt,
} from '@/lib/booth-planner/shared-aisle'
import type { LayoutPreset } from '@/lib/booth-planner/layout-presets'

export type GenericRowLayoutMode = 'vertical_rows' | 'horizontal_rows' | 'snake'

export function genericRowLayoutModeFromPreset(
  preset: LayoutPreset
): GenericRowLayoutMode | null {
  if (preset === 'vertical_rows' || preset === 'horizontal_rows' || preset === 'snake') {
    return preset
  }
  if (preset === 'aligned_grid') return 'horizontal_rows'
  return null
}

export function isGenericRowLayoutPreset(preset: LayoutPreset): boolean {
  return genericRowLayoutModeFromPreset(preset) != null
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

function blockedCellSet(elements: VenueElement[], cols: number, rows: number): Set<string> {
  const keys = new Set<string>()
  for (const el of elements) {
    if (el.type === 'stage') continue
    for (const { row, col } of cellsOfElement(el)) {
      if (row >= 0 && row < rows && col >= 0 && col < cols) {
        keys.add(`${row}-${col}`)
      }
    }
  }
  return keys
}

function preserveShell(
  elements: VenueElement[],
  cols: number,
  rows: number
): VenueElement[] {
  return elements.filter((el) => {
    if (el.type === 'aisle') return false
    if (isCoGeneratedBoothAisle(el)) return false
    return isImmutableVenueElement(el, cols, rows)
  })
}

/** Vertical shared-aisle column indices (4′ merged walkway between N–S booth columns). */
export function verticalSharedAisleColumns(bounds: InteriorBounds): number[] {
  const cols: number[] = []
  let blockStart = bounds.minCol + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS

  while (blockStart + CORRIDOR_AISLE_WIDTH_CELLS <= bounds.maxCol + 1) {
    for (let i = 0; i < CORRIDOR_AISLE_WIDTH_CELLS; i++) {
      const c = blockStart + i
      if (c <= bounds.maxCol) cols.push(c)
    }
    blockStart += CORRIDOR_AISLE_WIDTH_CELLS + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS
  }

  return cols
}

function isVerticalSharedAisleColumn(col: number, bounds: InteriorBounds): boolean {
  return verticalSharedAisleColumns(bounds).includes(col)
}

function columnOffsetInCycle(col: number, bounds: InteriorBounds): number {
  const base = col - bounds.minCol
  if (base < 0) return -1
  const stride = CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS + CORRIDOR_AISLE_WIDTH_CELLS
  return base % stride
}

function isVerticalVendorColumn(col: number, bounds: InteriorBounds): boolean {
  if (col < bounds.minCol || col > bounds.maxCol) return false
  if (isVerticalSharedAisleColumn(col, bounds)) return false
  const offset = columnOffsetInCycle(col, bounds)
  if (offset < 0) return false
  return offset < CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS
}

export type VerticalStripSide = 'west' | 'east'

export function verticalStripSideAt(col: number, bounds: InteriorBounds): VerticalStripSide | null {
  if (!isVerticalVendorColumn(col, bounds)) return null
  const aisles = verticalSharedAisleColumns(bounds)
  let nearestLeft = -Infinity
  let nearestRight = Infinity
  for (const ac of aisles) {
    if (ac < col) nearestLeft = Math.max(nearestLeft, ac)
    if (ac > col) nearestRight = Math.min(nearestRight, ac)
  }
  const distLeft = nearestLeft === -Infinity ? Infinity : col - nearestLeft
  const distRight = nearestRight === Infinity ? Infinity : nearestRight - col
  return distLeft <= distRight ? 'west' : 'east'
}

export function preferredStorefrontForVerticalStrip(strip: VerticalStripSide): StorefrontSide {
  return strip === 'west' ? 'right' : 'left'
}

export function isVerticalRowsClusterCell(
  row: number,
  col: number,
  cols: number,
  rows: number
): boolean {
  if (cols < 1 || rows < 1) return false
  const bounds = computeInteriorBounds(cols, rows)
  if (row < bounds.minRow || row > bounds.maxRow) return false
  if (col < bounds.minCol || col > bounds.maxCol) return false
  return isVerticalVendorColumn(col, bounds)
}

export function isVerticalRowsPlacement(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): boolean {
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      if (!isVerticalRowsClusterCell(r, c, cols, rows)) return false
    }
  }
  return true
}

export function isHorizontalRowsClusterCell(
  row: number,
  col: number,
  cols: number,
  rows: number
): boolean {
  if (cols < 1 || rows < 1) return false
  const bounds = computeInteriorBounds(cols, rows)
  if (row < bounds.minRow || row > bounds.maxRow) return false
  if (col < bounds.minCol || col > bounds.maxCol) return false
  if (isSharedAisleRow(row, bounds)) return false
  return isBackToBackVendorRow(row, bounds)
}

export function isHorizontalRowsPlacement(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): boolean {
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      if (!isHorizontalRowsClusterCell(r, c, cols, rows)) return false
    }
  }
  return true
}

export function buildVerticalRowsPlacementOrder(
  cols: number,
  rows: number,
  entrance: WallSide
): [number, number][] {
  if (cols < 1 || rows < 1) return []
  const bounds = computeInteriorBounds(cols, rows)
  const seen = new Set<string>()
  const order: [number, number][] = []

  const add = (r: number, c: number) => {
    const key = `${r}-${c}`
    if (seen.has(key)) return
    if (!isVerticalRowsClusterCell(r, c, cols, rows)) return
    seen.add(key)
    order.push([r, c])
  }

  const aisleCols = verticalSharedAisleColumns(bounds)
  const vendorCols: number[] = []
  for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
    if (isVerticalVendorColumn(c, bounds)) vendorCols.push(c)
  }

  const enterFromSouth = entrance === 'south' || entrance === 'west'
  for (const c of vendorCols) {
    if (enterFromSouth) {
      for (let r = bounds.minRow; r <= bounds.maxRow; r++) add(r, c)
    } else {
      for (let r = bounds.maxRow; r >= bounds.minRow; r--) add(r, c)
    }
  }

  void aisleCols
  return order
}

export function buildHorizontalRowsPlacementOrder(
  cols: number,
  rows: number,
  entrance: WallSide
): [number, number][] {
  if (cols < 1 || rows < 1) return []
  const bounds = computeInteriorBounds(cols, rows)
  const seen = new Set<string>()
  const order: [number, number][] = []

  const add = (r: number, c: number) => {
    const key = `${r}-${c}`
    if (seen.has(key)) return
    if (!isHorizontalRowsClusterCell(r, c, cols, rows)) return
    seen.add(key)
    order.push([r, c])
  }

  const enterFromSouth = entrance === 'south' || entrance === 'west'
  let r = bounds.minRow
  while (r + BACK_TO_BACK_PAIR_STRIDE_CELLS <= bounds.maxRow + 1) {
    for (const vendorRow of [r, r + BOOTH_ROW_DEPTH_CELLS + CORRIDOR_AISLE_WIDTH_CELLS]) {
      if (enterFromSouth) {
        for (let c = bounds.minCol; c <= bounds.maxCol; c++) add(vendorRow, c)
      } else {
        for (let c = bounds.maxCol; c >= bounds.minCol; c--) add(vendorRow, c)
      }
    }
    r += BACK_TO_BACK_PAIR_STRIDE_CELLS
  }

  return order
}

function paintVerticalSharedAisles(
  elements: VenueElement[],
  bounds: InteriorBounds,
  skip: Set<string>
): void {
  for (const c of verticalSharedAisleColumns(bounds)) {
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      if (skip.has(`${r}-${c}`)) continue
      elements.push(aisleCell(r, c, 'Vertical aisle'))
    }
  }
}

function paintHorizontalSharedAisles(
  elements: VenueElement[],
  bounds: InteriorBounds,
  skip: Set<string>
): void {
  for (const r of sharedAisleRowsToPaint(bounds)) {
    for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
      if (skip.has(`${r}-${c}`)) continue
      elements.push(aisleCell(r, c, 'Horizontal aisle'))
    }
  }
}

function paintEntranceThreshold(
  elements: VenueElement[],
  cols: number,
  rows: number,
  entrance: WallSide,
  existing: VenueElement[],
  skip: Set<string>
): void {
  const mainEntrance = existing.find((e) => e.type === 'entrance')
  if (!mainEntrance) return

  const spanC = mainEntrance.colSpan ?? 1
  const spanR = mainEntrance.rowSpan ?? 1
  const startCol = mainEntrance.col
  const endCol = mainEntrance.col + spanC - 1

  if (entrance === 'south') {
    for (let d = 1; d <= CORRIDOR_THRESHOLD_BUFFER_CELLS; d++) {
      const r = mainEntrance.row + spanR - 1 + d
      if (r >= rows) continue
      for (let c = startCol; c <= endCol; c++) {
        if (skip.has(`${r}-${c}`)) continue
        elements.push(aisleCell(r, c, 'Entrance threshold'))
      }
    }
  } else if (entrance === 'north') {
    for (let d = 1; d <= CORRIDOR_THRESHOLD_BUFFER_CELLS; d++) {
      const r = mainEntrance.row - d
      if (r < 0) continue
      for (let c = startCol; c <= endCol; c++) {
        if (skip.has(`${r}-${c}`)) continue
        elements.push(aisleCell(r, c, 'Entrance threshold'))
      }
    }
  }
}

function buildGenericRowShell(
  mode: GenericRowLayoutMode,
  cols: number,
  rows: number,
  entrance: WallSide,
  existingElements: VenueElement[]
): VenueElement[] {
  if (mode === 'snake') {
    return buildIndoorCorridorShell(cols, rows, entrance, existingElements)
  }

  const preserved = preserveShell(existingElements, cols, rows)
  const skip = blockedCellSet(preserved, cols, rows)
  const bounds = computeInteriorBounds(cols, rows)
  const painted: VenueElement[] = []

  paintEntranceThreshold(painted, cols, rows, entrance, preserved, skip)
  if (mode === 'vertical_rows') {
    paintVerticalSharedAisles(painted, bounds, skip)
  } else {
    paintHorizontalSharedAisles(painted, bounds, skip)
  }

  for (const el of painted) {
    for (const { row, col } of cellsOfElement(el)) {
      skip.add(`${row}-${col}`)
    }
  }

  return [...preserved, ...painted]
}

export interface GenericRowLayoutPatch {
  venue_elements: VenueElement[]
  cells: BoothCell[]
}

export function applyGenericRowLayout(
  mode: GenericRowLayoutMode,
  cols: number,
  rows: number,
  entrance: WallSide,
  existingElements: VenueElement[]
): GenericRowLayoutPatch {
  return {
    venue_elements: buildGenericRowShell(mode, cols, rows, entrance, existingElements),
    cells: [],
  }
}

function rankOriginsByOrder(
  candidates: [number, number][],
  order: [number, number][]
): [number, number][] {
  const rank = new Map<string, number>()
  order.forEach(([row, col], i) => rank.set(`${row}-${col}`, i))
  return candidates.sort((a, b) => {
    const ra = rank.get(`${a[0]}-${a[1]}`) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(`${b[0]}-${b[1]}`) ?? Number.MAX_SAFE_INTEGER
    return ra - rb
  })
}

export function verticalRowsOriginsForBooth(
  rows: number,
  cols: number,
  entrance: WallSide,
  rowSpan: number,
  colSpan: number
): [number, number][] {
  const candidates: [number, number][] = []
  for (let r = 0; r <= rows - rowSpan; r++) {
    for (let c = 0; c <= cols - colSpan; c++) {
      if (isVerticalRowsPlacement(r, c, rowSpan, colSpan, rows, cols)) {
        candidates.push([r, c])
      }
    }
  }
  return rankOriginsByOrder(candidates, buildVerticalRowsPlacementOrder(cols, rows, entrance))
}

export function horizontalRowsOriginsForBooth(
  rows: number,
  cols: number,
  entrance: WallSide,
  rowSpan: number,
  colSpan: number
): [number, number][] {
  const candidates: [number, number][] = []
  for (let r = 0; r <= rows - rowSpan; r++) {
    for (let c = 0; c <= cols - colSpan; c++) {
      if (isHorizontalRowsPlacement(r, c, rowSpan, colSpan, rows, cols)) {
        candidates.push([r, c])
      }
    }
  }
  return rankOriginsByOrder(candidates, buildHorizontalRowsPlacementOrder(cols, rows, entrance))
}

export function genericRowOriginsForBooth(
  mode: GenericRowLayoutMode,
  rows: number,
  cols: number,
  entrance: WallSide,
  rowSpan: number,
  colSpan: number
): [number, number][] {
  if (mode === 'vertical_rows') {
    return verticalRowsOriginsForBooth(rows, cols, entrance, rowSpan, colSpan)
  }
  if (mode === 'horizontal_rows') {
    return horizontalRowsOriginsForBooth(rows, cols, entrance, rowSpan, colSpan)
  }
  return indoorCorridorOriginsForBooth(rows, cols, entrance, rowSpan, colSpan)
}

export function isGenericRowPlacement(
  mode: GenericRowLayoutMode,
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): boolean {
  if (mode === 'vertical_rows') {
    return isVerticalRowsPlacement(row, col, rowSpan, colSpan, rows, cols)
  }
  if (mode === 'horizontal_rows') {
    return isHorizontalRowsPlacement(row, col, rowSpan, colSpan, rows, cols)
  }
  return isIndoorCorridorPlacement(row, col, rowSpan, colSpan, rows, cols)
}

/** Local flow vector for generic row presets (path-parallel scoring). */
export function genericRowFlowVectorAt(
  mode: GenericRowLayoutMode,
  cols: number,
  rows: number,
  entrance: WallSide,
  row: number,
  col: number
): { dr: number; dc: number } | null {
  if (mode === 'vertical_rows') {
    const order = buildVerticalRowsPlacementOrder(cols, rows, entrance)
    const idx = order.findIndex(([r, c]) => r === row && c === col)
    if (idx < 0 || idx >= order.length - 1) return { dr: 1, dc: 0 }
    const [r1, c1] = order[idx]
    const [r2, c2] = order[idx + 1]
    return { dr: r2 - r1, dc: c2 - c1 }
  }
  if (mode === 'horizontal_rows') {
    const order = buildHorizontalRowsPlacementOrder(cols, rows, entrance)
    const idx = order.findIndex(([r, c]) => r === row && c === col)
    if (idx < 0 || idx >= order.length - 1) return { dr: 0, dc: 1 }
    const [r1, c1] = order[idx]
    const [r2, c2] = order[idx + 1]
    return { dr: r2 - r1, dc: c2 - c1 }
  }
  return indoorCorridorFlowVectorAt(cols, rows, entrance, row, col)
}

/** Bonus for storefront facing the nearest shared aisle centerline. */
export function genericRowStorefrontBonus(
  mode: GenericRowLayoutMode,
  row: number,
  col: number,
  colSpan: number,
  rowSpan: number,
  storefront: StorefrontSide,
  cols: number,
  rows: number
): number {
  const bounds = computeInteriorBounds(cols, rows)

  if (mode === 'vertical_rows') {
    const strip = verticalStripSideAt(col, bounds)
    if (!strip) return 0
    return storefront === preferredStorefrontForVerticalStrip(strip) ? 5000 : -5000
  }

  if (mode === 'horizontal_rows') {
    const strip = sharedAisleStripAt(row, bounds)
    if (!strip) return 0
    return storefront === preferredStorefrontForSharedStrip(strip) ? 5000 : -5000
  }

  void colSpan
  void rowSpan
  return 0
}
