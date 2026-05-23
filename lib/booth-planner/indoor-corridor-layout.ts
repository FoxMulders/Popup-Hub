/**
 * Indoor hall corridor grammar — preserves perimeter walls and paints serpentine
 * compact aisle networks inside the vendor zone (auto-detected when outdoor preset + walls).
 */
import type { BoothCell, VenueElement } from '@/types/database'
import type { WallSide } from '@/lib/booth-planner/venue-elements'
import {
  isCoGeneratedBoothAisle,
  isImmutableVenueElement,
} from '@/lib/booth-planner/venue-elements'
import {
  PERIMETER_VENDING_MARGIN_CELLS,
  cellsOfElement,
  isOuterPerimeterCell,
} from '@/lib/booth-planner/perimeter-clearance'
import { MIN_STROLLER_AISLE_WIDTH_FT } from '@/lib/booth-planner/layout-clearance-constants'
import { CO_GENERATED_AISLE_DEPTH_CELLS } from '@/lib/booth-planner/co-generated-aisles'
import { findVenueAnchors } from '@/lib/booth-planner/venue-anchors'
import {
  isSharedAisleRow,
  isBackToBackVendorRow,
  isInteriorBlockColumn,
  sharedAisleRowsToPaint,
  interiorBlockColumnRange,
} from '@/lib/booth-planner/shared-aisle'

export { hallHasIndoorShell } from '@/lib/booth-planner/indoor-shell'

/** Vertical row aisles between booth column blocks (2′ + 2′ shared). */
export const CORRIDOR_AISLE_WIDTH_CELLS = CO_GENERATED_AISLE_DEPTH_CELLS * 2
export const CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS = 8
export const CORRIDOR_THRESHOLD_BUFFER_CELLS = MIN_STROLLER_AISLE_WIDTH_FT

export interface InteriorBounds {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
}

export interface IndoorCorridorLayoutPatch {
  venue_elements: VenueElement[]
  cells: BoothCell[]
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

/** Vendor zone interior — inside walls, outside the 4′ concourse ring. */
export function computeInteriorBounds(cols: number, rows: number): InteriorBounds {
  const m = PERIMETER_VENDING_MARGIN_CELLS
  return {
    minRow: m + 1,
    maxRow: rows - 1 - m,
    minCol: m + 1,
    maxCol: cols - 1 - m,
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

/** Vertical shared-aisle column indices clipped to interior bounds. */
export function indoorVerticalAisleColumns(cols: number, bounds: InteriorBounds): number[] {
  const aisleCols: number[] = []
  let blockStart = bounds.minCol + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS

  while (blockStart + CORRIDOR_AISLE_WIDTH_CELLS <= bounds.maxCol + 1) {
    for (let i = 0; i < CORRIDOR_AISLE_WIDTH_CELLS; i++) {
      const c = blockStart + i
      if (c <= bounds.maxCol) aisleCols.push(c)
    }
    blockStart += CORRIDOR_AISLE_WIDTH_CELLS + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS
  }

  return aisleCols
}

function isIndoorAisleColumn(col: number, cols: number, bounds: InteriorBounds): boolean {
  return indoorVerticalAisleColumns(cols, bounds).includes(col)
}

/** True when origin sits in an indoor corridor vendor cluster (not aisle / concourse-only). */
export function isIndoorCorridorClusterCell(
  row: number,
  col: number,
  cols: number,
  rows: number
): boolean {
  if (cols < 1 || rows < 1) return false
  const bounds = computeInteriorBounds(cols, rows)
  if (row < bounds.minRow || row > bounds.maxRow) return false
  if (col < bounds.minCol || col > bounds.maxCol) return false
  if (isIndoorAisleColumn(col, cols, bounds)) return false
  if (isInteriorBlockColumn(col, bounds) && isSharedAisleRow(row, bounds)) return false

  const westBand = col >= bounds.minCol && col < bounds.minCol + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS
  const eastBand = col > bounds.maxCol - CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS && col <= bounds.maxCol
  if (westBand || eastBand) return true

  if (isInteriorBlockColumn(col, bounds)) {
    return isBackToBackVendorRow(row, bounds)
  }

  return false
}

export function isIndoorCorridorPlacement(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): boolean {
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      if (!isIndoorCorridorClusterCell(r, c, cols, rows)) return false
    }
  }
  return true
}

export function buildIndoorCorridorPlacementOrder(
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
    if (!isIndoorCorridorClusterCell(r, c, cols, rows)) return
    seen.add(key)
    order.push([r, c])
  }

  const westStrip = () => {
    for (let c = bounds.minCol; c < bounds.minCol + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS; c++) {
      for (let r = bounds.minRow; r <= bounds.maxRow; r++) add(r, c)
    }
  }

  const southStrip = () => {
    for (let c = bounds.minCol + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS; c <= bounds.maxCol; c++) {
      for (let r = bounds.minRow; r < bounds.minRow + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS; r++) {
        add(r, c)
      }
    }
  }

  const eastStrip = () => {
    for (let c = bounds.maxCol - CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS + 1; c <= bounds.maxCol; c++) {
      for (let r = bounds.maxRow; r >= bounds.minRow; r--) add(r, c)
    }
  }

  const interiorSerpentine = () => {
    let blockStart = bounds.minCol + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS
    let down = true
    while (blockStart + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS <= bounds.maxCol + 1) {
      const blockEnd = Math.min(blockStart + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS - 1, bounds.maxCol)
      if (down) {
        for (let c = blockStart; c <= blockEnd; c++) {
          for (let r = bounds.minRow; r <= bounds.maxRow; r++) add(r, c)
        }
      } else {
        for (let c = blockStart; c <= blockEnd; c++) {
          for (let r = bounds.maxRow; r >= bounds.minRow; r--) add(r, c)
        }
      }
      down = !down
      blockStart += CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS + CORRIDOR_AISLE_WIDTH_CELLS
    }
  }

  if (entrance === 'south') {
    southStrip()
    westStrip()
    interiorSerpentine()
    eastStrip()
  } else if (entrance === 'north') {
    eastStrip()
    westStrip()
    interiorSerpentine()
    southStrip()
  } else if (entrance === 'west') {
    westStrip()
    southStrip()
    interiorSerpentine()
    eastStrip()
  } else {
    eastStrip()
    southStrip()
    interiorSerpentine()
    westStrip()
  }

  return order
}

export function indoorCorridorOriginsForBooth(
  rows: number,
  cols: number,
  entrance: WallSide,
  rowSpan: number,
  colSpan: number
): [number, number][] {
  const candidates: [number, number][] = []
  for (let r = 0; r <= rows - rowSpan; r++) {
    for (let c = 0; c <= cols - colSpan; c++) {
      if (isIndoorCorridorPlacement(r, c, rowSpan, colSpan, rows, cols)) {
        candidates.push([r, c])
      }
    }
  }

  const clusterOrder = buildIndoorCorridorPlacementOrder(cols, rows, entrance)
  const rank = new Map<string, number>()
  clusterOrder.forEach(([row, col], i) => rank.set(`${row}-${col}`, i))

  return candidates.sort((a, b) => {
    const ra = rank.get(`${a[0]}-${a[1]}`) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(`${b[0]}-${b[1]}`) ?? Number.MAX_SAFE_INTEGER
    return ra - rb
  })
}

function preserveIndoorShell(
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

  const interiorRows: number[] = []
  if (entrance === 'south') {
    for (let d = 1; d <= CORRIDOR_THRESHOLD_BUFFER_CELLS; d++) {
      interiorRows.push(mainEntrance.row + spanR - 1 + d)
    }
  } else if (entrance === 'north') {
    for (let d = 1; d <= CORRIDOR_THRESHOLD_BUFFER_CELLS; d++) {
      interiorRows.push(mainEntrance.row - d)
    }
  } else if (entrance === 'west') {
    for (let d = 1; d <= CORRIDOR_THRESHOLD_BUFFER_CELLS; d++) {
      for (let r = mainEntrance.row; r < mainEntrance.row + spanR; r++) {
        const c = mainEntrance.col + spanC - 1 + d
        if (skip.has(`${r}-${c}`)) continue
        if (c >= cols) continue
        elements.push(aisleCell(r, c, 'Entrance threshold'))
      }
    }
    return
  } else {
    for (let d = 1; d <= CORRIDOR_THRESHOLD_BUFFER_CELLS; d++) {
      for (let r = mainEntrance.row; r < mainEntrance.row + spanR; r++) {
        const c = mainEntrance.col - d
        if (skip.has(`${r}-${c}`)) continue
        if (c < 0) continue
        elements.push(aisleCell(r, c, 'Entrance threshold'))
      }
    }
    return
  }

  for (const r of interiorRows) {
    if (r < 0 || r >= rows) continue
    for (let c = startCol; c <= endCol; c++) {
      if (skip.has(`${r}-${c}`)) continue
      elements.push(aisleCell(r, c, 'Entrance threshold'))
    }
  }
}

function paintExitBuffers(
  elements: VenueElement[],
  cols: number,
  rows: number,
  entrance: WallSide,
  existing: VenueElement[],
  skip: Set<string>
): void {
  const exits = existing.filter((e) => e.type === 'exit')
  for (const exit of exits) {
    const spanC = exit.colSpan ?? 1
    const spanR = exit.rowSpan ?? 1

    for (let d = 1; d <= CORRIDOR_THRESHOLD_BUFFER_CELLS; d++) {
      if (exit.row === 0 || (entrance === 'south' && exit.row === 0)) {
        const r = exit.row + spanR - 1 + d
        if (r >= rows) continue
        for (let c = exit.col; c < exit.col + spanC; c++) {
          if (skip.has(`${r}-${c}`)) continue
          elements.push(aisleCell(r, c, 'Exit buffer'))
        }
      } else if (exit.row === rows - 1 || (entrance === 'north' && exit.row === rows - 1)) {
        const r = exit.row - d
        if (r < 0) continue
        for (let c = exit.col; c < exit.col + spanC; c++) {
          if (skip.has(`${r}-${c}`)) continue
          elements.push(aisleCell(r, c, 'Exit buffer'))
        }
      } else if (exit.col === 0) {
        for (let r = exit.row; r < exit.row + spanR; r++) {
          const c = exit.col + spanC - 1 + d
          if (c >= cols) continue
          if (skip.has(`${r}-${c}`)) continue
          elements.push(aisleCell(r, c, 'Exit buffer'))
        }
      } else if (exit.col === cols - 1 || exit.col + spanC - 1 === cols - 1) {
        for (let r = exit.row; r < exit.row + spanR; r++) {
          const c = exit.col - d
          if (c < 0) continue
          if (skip.has(`${r}-${c}`)) continue
          elements.push(aisleCell(r, c, 'Exit buffer'))
        }
      }
    }
  }
}

function paintSharedRowAisles(
  elements: VenueElement[],
  bounds: InteriorBounds,
  skip: Set<string>
): void {
  const { minCol, maxCol } = interiorBlockColumnRange(bounds)
  for (const r of sharedAisleRowsToPaint(bounds)) {
    for (let c = minCol; c <= maxCol; c++) {
      if (skip.has(`${r}-${c}`)) continue
      elements.push(aisleCell(r, c, 'Shared aisle'))
    }
  }
}

function paintIndoorVerticalAisles(
  elements: VenueElement[],
  cols: number,
  rows: number,
  bounds: InteriorBounds,
  skip: Set<string>
): void {
  const aisleCols = indoorVerticalAisleColumns(cols, bounds)
  for (const c of aisleCols) {
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      if (skip.has(`${r}-${c}`)) continue
      elements.push(aisleCell(r, c, 'Row aisle'))
    }
  }
}

function paintIndoorSerpentineSpine(
  elements: VenueElement[],
  cols: number,
  rows: number,
  bounds: InteriorBounds,
  skip: Set<string>
): void {
  let blockStart = bounds.minCol + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS
  let flip = false

  while (blockStart + CORRIDOR_AISLE_WIDTH_CELLS < bounds.maxCol) {
    const connectorRow = flip ? bounds.minRow + 2 : bounds.maxRow - 2
    for (let c = blockStart - 2; c < blockStart + CORRIDOR_AISLE_WIDTH_CELLS + 2; c++) {
      if (c < bounds.minCol || c > bounds.maxCol) continue
      if (skip.has(`${connectorRow}-${c}`)) continue
      elements.push(aisleCell(connectorRow, c, 'Serpentine flow'))
    }
    blockStart += CORRIDOR_AISLE_WIDTH_CELLS + CORRIDOR_BOOTH_BLOCK_DEPTH_CELLS
    flip = !flip
  }
}

function paintRearAnchorLane(
  elements: VenueElement[],
  cols: number,
  rows: number,
  entrance: WallSide,
  existing: VenueElement[],
  bounds: InteriorBounds,
  skip: Set<string>
): void {
  const anchors = findVenueAnchors(existing)
  if (anchors.length === 0) return

  const rearRow =
    entrance === 'south'
      ? bounds.maxRow - 2
      : entrance === 'north'
        ? bounds.minRow + 2
        : Math.floor((bounds.minRow + bounds.maxRow) / 2)

  if (rearRow < bounds.minRow || rearRow > bounds.maxRow) return

  for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
    if (skip.has(`${rearRow}-${c}`)) continue
    elements.push(aisleCell(rearRow, c, 'Anchor approach'))
  }
}

/** Build corridor aisle network inside a walled hall — preserves structure + annex. */
export function buildIndoorCorridorShell(
  cols: number,
  rows: number,
  entrance: WallSide,
  existingElements: VenueElement[]
): VenueElement[] {
  const preserved = preserveIndoorShell(existingElements, cols, rows)
  const skip = blockedCellSet(preserved, cols, rows)
  const bounds = computeInteriorBounds(cols, rows)
  const corridorAisles: VenueElement[] = []

  paintEntranceThreshold(corridorAisles, cols, rows, entrance, preserved, skip)
  paintExitBuffers(corridorAisles, cols, rows, entrance, preserved, skip)
  paintSharedRowAisles(corridorAisles, bounds, skip)
  paintIndoorVerticalAisles(corridorAisles, cols, rows, bounds, skip)
  paintIndoorSerpentineSpine(corridorAisles, cols, rows, bounds, skip)
  paintRearAnchorLane(corridorAisles, cols, rows, entrance, preserved, bounds, skip)

  for (const el of corridorAisles) {
    for (const { row, col } of cellsOfElement(el)) {
      skip.add(`${row}-${col}`)
    }
  }

  return [...preserved, ...corridorAisles]
}

/** Wipe booths and repaint corridor aisles while preserving hall shell. */
export function applyIndoorCorridorLayout(
  cols: number,
  rows: number,
  entrance: WallSide,
  existingElements: VenueElement[]
): IndoorCorridorLayoutPatch {
  return {
    venue_elements: buildIndoorCorridorShell(cols, rows, entrance, existingElements),
    cells: [],
  }
}

/** Flow direction at a cluster cell (for sightline scoring). */
export function indoorCorridorFlowVectorAt(
  cols: number,
  rows: number,
  entrance: WallSide,
  row: number,
  col: number
): { dr: number; dc: number } | null {
  const order = buildIndoorCorridorPlacementOrder(cols, rows, entrance)
  const idx = order.findIndex(([r, c]) => r === row && c === col)
  if (idx < 0 || idx >= order.length - 1) return null
  const [r1, c1] = order[idx]
  const [r2, c2] = order[idx + 1]
  return { dr: r2 - r1, dc: c2 - c1 }
}
