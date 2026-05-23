/**
 * Outdoor / street-fair market grammar (SWEFM + Urbana patterns):
 * - No fake hall walls — open lot bounded by streets
 * - Top pedestrian walkway, side + bottom vendor margins
 * - Vertical cluster-row aisles with optional serpentine spine
 * - Dual entrances (entrance + door), amenity slots
 */
import type { BoothCell, VenueElement } from '@/types/database'
import type { WallSide } from '@/lib/booth-planner/venue-elements'

export type OutdoorMarketVariant = 'street-fair' | 'parking-lot'

export interface OutdoorMarketShellOptions {
  cols: number
  rows: number
  entrance: WallSide
  variant?: OutdoorMarketVariant
  /** Urbana-style alternating horizontal connectors between row pairs. */
  includeSerpentineSpine?: boolean
}

export interface OutdoorMarketLayoutPatch {
  venue_elements: VenueElement[]
  cells: BoothCell[]
}

/** North pedestrian walkway depth (Illinois / Vine street-fair top edge). */
export const OUTDOOR_TOP_WALKWAY_CELLS = 8

/** South street-edge vendor strip depth. */
export const OUTDOOR_STREET_MARGIN_CELLS = 4

/** West / east perimeter vendor strips. */
export const OUTDOOR_SIDE_MARGIN_CELLS = 4

/** Clear width between back-to-back row pairs. */
export const OUTDOOR_ROW_AISLE_WIDTH_CELLS = 8

/** Depth of each vendor row block (N–S strip). */
export const OUTDOOR_BOOTH_ROW_DEPTH_CELLS = 12

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

function amenity(
  type: VenueElement['type'],
  row: number,
  col: number,
  colSpan: number,
  rowSpan: number,
  label: string
): VenueElement {
  return {
    id: newId(),
    type,
    row,
    col,
    colSpan,
    rowSpan,
    label,
    locked: true,
  }
}

/** Vertical aisle column indices for cluster-row layout. */
export function outdoorVerticalAisleColumns(cols: number): number[] {
  if (cols < OUTDOOR_SIDE_MARGIN_CELLS * 2 + OUTDOOR_BOOTH_ROW_DEPTH_CELLS + OUTDOOR_ROW_AISLE_WIDTH_CELLS) {
    return []
  }

  const aisleCols: number[] = []
  let blockStart = OUTDOOR_SIDE_MARGIN_CELLS + OUTDOOR_BOOTH_ROW_DEPTH_CELLS

  while (blockStart + OUTDOOR_ROW_AISLE_WIDTH_CELLS <= cols - OUTDOOR_SIDE_MARGIN_CELLS) {
    for (let i = 0; i < OUTDOOR_ROW_AISLE_WIDTH_CELLS; i++) {
      aisleCols.push(blockStart + i)
    }
    blockStart += OUTDOOR_ROW_AISLE_WIDTH_CELLS + OUTDOOR_BOOTH_ROW_DEPTH_CELLS
  }

  return aisleCols
}

function vendorRowBounds(rows: number): { minRow: number; maxRow: number } {
  const minRow = OUTDOOR_STREET_MARGIN_CELLS
  const maxRow = rows - 1 - OUTDOOR_TOP_WALKWAY_CELLS
  return { minRow, maxRow }
}

function isAisleColumn(col: number, cols: number): boolean {
  return outdoorVerticalAisleColumns(cols).includes(col)
}

/** True when a 1×1 origin sits in an outdoor vendor cluster zone (not open-lot core). */
export function isOutdoorClusterCell(
  row: number,
  col: number,
  cols: number,
  rows: number,
  variant: OutdoorMarketVariant = 'street-fair'
): boolean {
  if (cols < 1 || rows < 1) return false
  if (row < OUTDOOR_STREET_MARGIN_CELLS || row > rows - 1 - OUTDOOR_TOP_WALKWAY_CELLS) return false
  if (isAisleColumn(col, cols)) return false

  const westBand = col >= 1 && col < OUTDOOR_SIDE_MARGIN_CELLS + 1
  const eastBand = col >= cols - OUTDOOR_SIDE_MARGIN_CELLS - 1 && col < cols - 1
  const southBand = row < OUTDOOR_STREET_MARGIN_CELLS + OUTDOOR_SIDE_MARGIN_CELLS

  if (westBand || eastBand || southBand) return true

  if (variant === 'parking-lot') {
    const { minRow, maxRow } = vendorRowBounds(rows)
    const midRow = Math.floor((minRow + maxRow) / 2)
    const clusterRows =
      Math.abs(row - minRow - 4) <= 2 ||
      Math.abs(row - midRow) <= 2 ||
      Math.abs(row - maxRow + 4) <= 2
    const clusterCols = col >= OUTDOOR_SIDE_MARGIN_CELLS + 2 && col < cols - OUTDOOR_SIDE_MARGIN_CELLS - 2
    return clusterRows && clusterCols
  }

  return col >= OUTDOOR_SIDE_MARGIN_CELLS && col < cols - OUTDOOR_SIDE_MARGIN_CELLS
}

/** True when an entire booth footprint fits inside outdoor cluster zones. */
export function isClusterPlacement(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number,
  variant: OutdoorMarketVariant = 'street-fair'
): boolean {
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      if (!isOutdoorClusterCell(r, c, cols, rows, variant)) return false
    }
  }
  return true
}

/**
 * Market walk order: perimeter near entrance, then row-by-row serpentine through clusters.
 * Unlike expo perimeter ring — discrete rows (Urbana Row 1–5 / SWEFM clusters).
 */
export function buildClusterPlacementOrder(
  cols: number,
  rows: number,
  entrance: WallSide,
  variant: OutdoorMarketVariant = 'street-fair'
): [number, number][] {
  if (cols < 1 || rows < 1) return []

  const seen = new Set<string>()
  const order: [number, number][] = []
  const { minRow, maxRow } = vendorRowBounds(rows)

  const add = (r: number, c: number) => {
    const key = `${r}-${c}`
    if (seen.has(key)) return
    if (!isOutdoorClusterCell(r, c, cols, rows, variant)) return
    seen.add(key)
    order.push([r, c])
  }

  const westStrip = () => {
    const startCol = entrance === 'west' ? 1 : 1
    for (let c = startCol; c <= OUTDOOR_SIDE_MARGIN_CELLS; c++) {
      for (let r = minRow; r <= maxRow; r++) add(r, c)
    }
  }

  const southStrip = () => {
    for (let c = OUTDOOR_SIDE_MARGIN_CELLS + 1; c < cols - OUTDOOR_SIDE_MARGIN_CELLS - 1; c++) {
      for (let r = OUTDOOR_STREET_MARGIN_CELLS; r < OUTDOOR_STREET_MARGIN_CELLS + OUTDOOR_SIDE_MARGIN_CELLS; r++) {
        add(r, c)
      }
    }
  }

  const eastStrip = () => {
    for (let c = cols - OUTDOOR_SIDE_MARGIN_CELLS - 1; c < cols - 1; c++) {
      for (let r = maxRow; r >= minRow; r--) add(r, c)
    }
  }

  const interiorSerpentine = () => {
    let blockStart = OUTDOOR_SIDE_MARGIN_CELLS + 1
    let down = true
    while (blockStart + OUTDOOR_BOOTH_ROW_DEPTH_CELLS <= cols - OUTDOOR_SIDE_MARGIN_CELLS) {
      const blockEnd = blockStart + OUTDOOR_BOOTH_ROW_DEPTH_CELLS - 1
      if (down) {
        for (let c = blockStart; c <= blockEnd; c++) {
          for (let r = minRow; r <= maxRow; r++) add(r, c)
        }
      } else {
        for (let c = blockStart; c <= blockEnd; c++) {
          for (let r = maxRow; r >= minRow; r--) add(r, c)
        }
      }
      down = !down
      blockStart += OUTDOOR_BOOTH_ROW_DEPTH_CELLS + OUTDOOR_ROW_AISLE_WIDTH_CELLS
    }
  }

  if (entrance === 'north' || entrance === 'west') {
    westStrip()
    southStrip()
    interiorSerpentine()
    eastStrip()
  } else if (entrance === 'south') {
    southStrip()
    westStrip()
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

function paintTopWalkway(
  elements: VenueElement[],
  cols: number,
  rows: number,
  skip: Set<string>
): void {
  const topStart = rows - OUTDOOR_TOP_WALKWAY_CELLS
  for (let r = topStart; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (skip.has(`${r}-${c}`)) continue
      elements.push(aisleCell(r, c, 'Pedestrian walkway'))
    }
  }
}

function paintVerticalRowAisles(
  elements: VenueElement[],
  cols: number,
  rows: number,
  skip: Set<string>
): void {
  const aisleCols = outdoorVerticalAisleColumns(cols)
  const { minRow, maxRow } = vendorRowBounds(rows)
  for (const c of aisleCols) {
    for (let r = minRow; r <= maxRow; r++) {
      if (skip.has(`${r}-${c}`)) continue
      elements.push(aisleCell(r, c, 'Row aisle'))
    }
  }
}

function paintSerpentineSpine(
  elements: VenueElement[],
  cols: number,
  rows: number,
  skip: Set<string>
): void {
  const { minRow, maxRow } = vendorRowBounds(rows)
  const midRow = Math.floor((minRow + maxRow) / 2)
  let blockStart = OUTDOOR_SIDE_MARGIN_CELLS + OUTDOOR_BOOTH_ROW_DEPTH_CELLS
  let flip = false

  while (blockStart + OUTDOOR_ROW_AISLE_WIDTH_CELLS < cols - OUTDOOR_SIDE_MARGIN_CELLS) {
    const connectorRow = flip ? minRow + 2 : maxRow - 2
    for (let c = blockStart - 2; c < blockStart + OUTDOOR_ROW_AISLE_WIDTH_CELLS + 2; c++) {
      if (c < 0 || c >= cols) continue
      if (skip.has(`${connectorRow}-${c}`)) continue
      elements.push(aisleCell(connectorRow, c, 'Serpentine flow'))
    }
    blockStart += OUTDOOR_ROW_AISLE_WIDTH_CELLS + OUTDOOR_BOOTH_ROW_DEPTH_CELLS
    flip = !flip
  }

  for (let c = OUTDOOR_SIDE_MARGIN_CELLS; c < cols - OUTDOOR_SIDE_MARGIN_CELLS; c++) {
    if (skip.has(`${midRow}-${c}`)) continue
    elements.push(aisleCell(midRow, c, 'Cross flow'))
  }
}

function paintEntrances(
  elements: VenueElement[],
  cols: number,
  rows: number,
  entrance: WallSide
): Set<string> {
  const skip = new Set<string>()
  const span = Math.min(6, Math.max(4, Math.floor(cols * 0.1)))

  const stamp = (type: 'entrance' | 'door' | 'exit', row: number, col: number, colSpan: number, rowSpan: number, label: string) => {
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = col; c < col + colSpan; c++) {
        skip.add(`${r}-${c}`)
      }
    }
    elements.push({
      id: newId(),
      type,
      row,
      col,
      colSpan,
      rowSpan,
      label,
      locked: true,
    })
  }

  if (entrance === 'north') {
    stamp('entrance', rows - 1, 1, span, 1, 'Main entrance')
    stamp('door', rows - 1, cols - 1 - span, span, 1, 'North entrance')
    stamp('exit', rows - 1, Math.floor(cols / 2) - 2, 4, 1, 'Exit')
  } else if (entrance === 'south') {
    stamp('entrance', 0, 1, span, 1, 'Main entrance')
    stamp('door', 0, cols - 1 - span, span, 1, 'South entrance')
    stamp('exit', 0, Math.floor(cols / 2) - 2, 4, 1, 'Exit')
  } else if (entrance === 'west') {
    stamp('entrance', rows - 2, 0, 1, span, 'Main entrance')
    stamp('door', 1, 0, 1, span, 'West entrance')
    stamp('exit', Math.floor(rows / 2), 0, 1, 4, 'Exit')
  } else {
    stamp('entrance', rows - 2, cols - 1, 1, span, 'Main entrance')
    stamp('door', 1, cols - 1, 1, span, 'East entrance')
    stamp('exit', Math.floor(rows / 2), cols - 1, 1, 4, 'Exit')
  }

  return skip
}

function paintAmenities(
  elements: VenueElement[],
  cols: number,
  rows: number,
  variant: OutdoorMarketVariant,
  skip: Set<string>
): void {
  const topRow = rows - 2
  const infoCol = Math.floor(cols / 2) - 3
  const washCol = infoCol + 7

  const place = (el: VenueElement) => {
    const spanC = el.colSpan ?? 1
    const spanR = el.rowSpan ?? 1
    for (let r = el.row; r < el.row + spanR; r++) {
      for (let c = el.col; c < el.col + spanC; c++) {
        skip.add(`${r}-${c}`)
      }
    }
    elements.push(el)
  }

  if (infoCol >= OUTDOOR_SIDE_MARGIN_CELLS) {
    place(amenity('info_desk', topRow, infoCol, 6, 2, 'INFO / SNAP'))
  }
  if (washCol + 4 < cols - OUTDOOR_SIDE_MARGIN_CELLS) {
    place(amenity('restroom', topRow, washCol, 4, 2, 'Hand wash'))
  }

  place(
    amenity(
      'custom_label',
      rows - 4,
      1,
      OUTDOOR_SIDE_MARGIN_CELLS,
      3,
      variant === 'parking-lot' ? 'Food truck waiting' : 'Bike parking'
    )
  )

  if (variant === 'parking-lot') {
    place(amenity('seating', rows - 5, cols - OUTDOOR_SIDE_MARGIN_CELLS - 5, 5, 3, 'Picnic tables'))
  }
}

/**
 * Build outdoor market shell — no perimeter wall columns.
 */
export function buildOutdoorMarketShell({
  cols,
  rows,
  entrance,
  variant = 'street-fair',
  includeSerpentineSpine = true,
}: OutdoorMarketShellOptions): VenueElement[] {
  if (cols < 1 || rows < 1) return []

  const elements: VenueElement[] = []
  const skip = paintEntrances(elements, cols, rows, entrance)

  paintAmenities(elements, cols, rows, variant, skip)
  paintTopWalkway(elements, cols, rows, skip)

  if (variant === 'street-fair') {
    paintVerticalRowAisles(elements, cols, rows, skip)
    if (includeSerpentineSpine) {
      paintSerpentineSpine(elements, cols, rows, skip)
    }
  }

  return elements
}

/** Wipe booth placements and paint a fresh outdoor market shell. */
export function applyOutdoorMarketLayout(
  cols: number,
  rows: number,
  entrance: WallSide,
  variant: OutdoorMarketVariant = 'street-fair'
): OutdoorMarketLayoutPatch {
  return {
    venue_elements: buildOutdoorMarketShell({ cols, rows, entrance, variant }),
    cells: [],
  }
}

/** Origins in cluster walk order that fit a booth footprint. */
export function clusterOriginsForBooth(
  rows: number,
  cols: number,
  entrance: WallSide,
  rowSpan: number,
  colSpan: number,
  variant: OutdoorMarketVariant = 'street-fair'
): [number, number][] {
  const candidates: [number, number][] = []
  for (let r = 0; r <= rows - rowSpan; r++) {
    for (let c = 0; c <= cols - colSpan; c++) {
      if (isClusterPlacement(r, c, rowSpan, colSpan, rows, cols, variant)) {
        candidates.push([r, c])
      }
    }
  }

  const clusterOrder = buildClusterPlacementOrder(cols, rows, entrance, variant)
  const rank = new Map<string, number>()
  clusterOrder.forEach(([row, col], i) => rank.set(`${row}-${col}`, i))

  return candidates.sort((a, b) => {
    const ra = rank.get(`${a[0]}-${a[1]}`) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(`${b[0]}-${b[1]}`) ?? Number.MAX_SAFE_INTEGER
    return ra - rb
  })
}
