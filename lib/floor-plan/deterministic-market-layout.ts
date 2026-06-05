/**
 * Deterministic Computational Geometry & Market Layout Engine — PopupHub.ca
 *
 * Same inputs always yield the same layout. No randomness.
 * Modes: grid | staggered | perimeter
 *
 * Room merge unions (A ∪ B outer perimeter only) are handled separately in
 * `polygon-clipping-union.ts` and `placement-surface.ts`.
 */

export type MarketLayoutMode = 'grid' | 'staggered' | 'perimeter'

export type LayoutConstraintType =
  | 'entrance'
  | 'exit'
  | 'wall'
  | 'restricted_zone'

export interface MarketLayoutPoint {
  x: number
  y: number
}

/** Canonical API request (Section I). */
export interface MarketLayoutRequest {
  marketDimensions: { width: number; height: number }
  tableDimensions: { width: number; height: number }
  totalTables: number
  /** Defaults to `table_001` … `table_N`. */
  tableIds?: ReadonlyArray<string>
  layoutMode: MarketLayoutMode
  /** Minimum straight aisle width (ft). Default 8. */
  aisleSpacing?: number
  constraints?: ReadonlyArray<{
    type: LayoutConstraintType
    bounds: ReadonlyArray<MarketLayoutPoint>
  }>
  /** Inset from market rectangle (ft). Default 3.5. */
  wallInsetFt?: number
  premiumLocations?: ReadonlyArray<MarketLayoutPoint>
}

/** Canonical JSON placement (Section V). */
export interface MarketLayoutPlacementJson {
  id: string
  x: number
  y: number
  rotation: 0 | 90
  /** 1-based row index; row 1 is closest to the entrance. */
  row: number
  /** 1-based column index; columns increase left → right. */
  column: number
  aisleSpacing: number
  layoutMode: MarketLayoutMode
}

/** @deprecated Use `MarketLayoutRequest` — kept for auto-arrange bridge. */
export interface DeterministicMarketLayoutInput {
  marketWidthFt: number
  marketHeightFt: number
  tableWidthFt: number
  tableHeightFt: number
  tableCount: number
  tableIds: ReadonlyArray<string>
  layoutMode: MarketLayoutMode
  aisleWidthFt?: number
  wallInsetFt?: number
  snapFt?: number
  entrance?: MarketLayoutPoint
  restrictedZones?: ReadonlyArray<MarketLayoutRect>
  premiumLocations?: ReadonlyArray<MarketLayoutPoint>
}

export interface MarketLayoutRect {
  x: number
  y: number
  width: number
  height: number
}

/** Internal placement before JSON export. */
export interface MarketLayoutTablePlacement {
  tableId: string
  x: number
  y: number
  rotation: 0 | 90
  row: number
  column: number
  aisleSpacingFt: number
  layoutMode: MarketLayoutMode
}

export type DeterministicMarketLayoutSuccess = {
  ok: true
  placements: MarketLayoutTablePlacement[]
  /** Ordered valid slots (may exceed `placements` when obstacles thin the grid). */
  layoutSlotCandidates: SlotCandidate[]
  jsonPlacements: MarketLayoutPlacementJson[]
  asciiDiagram: string
  explanation: string
  layoutMode: MarketLayoutMode
  perimeterCapacity?: number
}

export type DeterministicMarketLayoutFailure = {
  ok: false
  error: string
  maxPerimeterCapacity: number
  layoutMode: 'perimeter'
}

export type DeterministicMarketLayoutResult =
  | DeterministicMarketLayoutSuccess
  | DeterministicMarketLayoutFailure

export const DEFAULT_AISLE_WIDTH_FT = 8
export const DEFAULT_WALL_INSET_FT = 3.5
/** Edge-to-edge gap between booth footprints in grid/staggered columns (ft). */
export const TABLE_EDGE_GAP_FT = 2

export interface SlotCandidate {
  x: number
  y: number
  /** 0-based row index (emit as row + 1). */
  row: number
  /** 0-based column index (emit as column + 1). */
  column: number
  rotation: 0 | 90
}

function defaultTableIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    `table_${String(i + 1).padStart(3, '0')}`
  )
}

function polygonBounds(
  points: ReadonlyArray<MarketLayoutPoint>
): MarketLayoutRect | null {
  if (points.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

function polygonCentroid(
  points: ReadonlyArray<MarketLayoutPoint>
): MarketLayoutPoint | null {
  if (points.length === 0) return null
  let sx = 0
  let sy = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
  }
  return { x: sx / points.length, y: sy / points.length }
}

function parseConstraints(constraints: MarketLayoutRequest['constraints']): {
  entrance?: MarketLayoutPoint
  restrictedZones: MarketLayoutRect[]
} {
  const restrictedZones: MarketLayoutRect[] = []
  let entrance: MarketLayoutPoint | undefined

  for (const c of constraints ?? []) {
    const box = polygonBounds(c.bounds)
    if (!box) continue
    if (c.type === 'entrance') {
      entrance = polygonCentroid(c.bounds) ?? {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      }
    }
    if (
      c.type === 'restricted_zone' ||
      c.type === 'wall' ||
      c.type === 'exit'
    ) {
      restrictedZones.push(box)
    }
  }

  return { entrance, restrictedZones }
}

/** Snap to uniform grid cells sized by table width / height. */
function snapToTableGrid(
  value: number,
  cell: number,
  origin: number
): number {
  if (cell <= 0) return value
  const steps = Math.round((value - origin) / cell)
  return origin + steps * cell
}

function rectOverlaps(a: MarketLayoutRect, b: MarketLayoutRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

function tableRect(
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: 0 | 90
): MarketLayoutRect {
  if (rotation === 90) {
    return { x, y, width: h, height: w }
  }
  return { x, y, width: w, height: h }
}

function hitsRestricted(
  rect: MarketLayoutRect,
  zones: ReadonlyArray<MarketLayoutRect>
): boolean {
  return zones.some((z) => rectOverlaps(rect, z))
}

function fitsBounds(
  rect: MarketLayoutRect,
  cw: number,
  ch: number,
  inset: number
): boolean {
  return (
    rect.x >= inset - 1e-6 &&
    rect.y >= inset - 1e-6 &&
    rect.x + rect.width <= cw - inset + 1e-6 &&
    rect.y + rect.height <= ch - inset + 1e-6
  )
}

/**
 * Row 1 sits on the market edge nearest the entrance; subsequent rows
 * step along +Y when the entrance is on the top edge, else −Y.
 */
function rowY(
  entrance: MarketLayoutPoint | undefined,
  ch: number,
  inset: number,
  th: number,
  rowIndex0: number,
  rowStep: number
): number {
  const entranceOnTop =
    entrance == null ? true : entrance.y <= ch / 2
  if (entranceOnTop) {
    return inset + rowIndex0 * rowStep
  }
  return ch - inset - th - rowIndex0 * rowStep
}

/** Stagger: 1-based odd rows (1,3,5) at min X; even rows (2,4,6) offset by half width. */
function staggerOffsetX(rowIndex0: number, tw: number): number {
  const rowNumber = rowIndex0 + 1
  return rowNumber % 2 === 0 ? tw / 2 : 0
}

function buildInteriorSlots(
  cw: number,
  ch: number,
  tw: number,
  th: number,
  aisleFt: number,
  inset: number,
  mode: 'grid' | 'staggered',
  entrance: MarketLayoutPoint | undefined,
  restrictedZones: ReadonlyArray<MarketLayoutRect>
): SlotCandidate[] {
  const rowStep = th + aisleFt
  const colStep = tw + TABLE_EDGE_GAP_FT
  const minX = inset
  const slots: SlotCandidate[] = []
  let rowIndex0 = 0

  while (rowIndex0 < 5000) {
    const y = snapToTableGrid(
      rowY(entrance, ch, inset, th, rowIndex0, rowStep),
      th,
      inset
    )
    if (y + th > ch - inset + 1e-6 || y < inset - 1e-6) {
      if (rowIndex0 === 0) break
      const entranceOnTop = entrance == null ? true : entrance.y <= ch / 2
      if (entranceOnTop && y + th > ch - inset + 1e-6) break
      if (!entranceOnTop && y < inset - 1e-6) break
      if (rowIndex0 > 0) break
    }

    const xOffset = mode === 'staggered' ? staggerOffsetX(rowIndex0, tw) : 0
    let colIndex0 = 0

    while (minX + xOffset + colIndex0 * colStep + tw <= cw - inset + 1e-6) {
      const x =
        mode === 'grid'
          ? snapToTableGrid(minX + colIndex0 * colStep, tw, minX)
          : minX + xOffset + colIndex0 * colStep
      const rect = tableRect(x, y, tw, th, 0)
      if (
        fitsBounds(rect, cw, ch, inset) &&
        !hitsRestricted(rect, restrictedZones)
      ) {
        slots.push({
          x,
          y,
          row: rowIndex0,
          column: colIndex0,
          rotation: 0,
        })
      }
      colIndex0++
    }

    rowIndex0++
    const nextY = rowY(entrance, ch, inset, th, rowIndex0, rowStep)
    if (entrance == null || entrance.y <= ch / 2) {
      if (nextY + th > ch - inset + 1e-6) break
    } else if (nextY < inset - 1e-6) {
      break
    }
  }

  return slots.sort((a, b) => {
    if (a.row !== b.row) return a.row - b.row
    return a.column - b.column
  })
}

/** Clockwise perimeter ribbon: top L→R, right T→B, bottom R→L, left B→T. */
function buildPerimeterSlots(
  cw: number,
  ch: number,
  tw: number,
  th: number,
  aisleFt: number,
  inset: number
): SlotCandidate[] {
  const alongStep = tw + aisleFt
  const alongStepY = th + aisleFt
  const slots: SlotCandidate[] = []

  const push = (
    x: number,
    y: number,
    rotation: 0 | 90,
    edgeIndex: number,
    col: number
  ) => {
    slots.push({
      x: snapToTableGrid(x, tw, inset),
      y: snapToTableGrid(y, th, inset),
      row: edgeIndex,
      column: col,
      rotation,
    })
  }

  let col = 0
  for (let x = inset; x + tw <= cw - inset + 1e-6; x += alongStep) {
    push(x, inset, 0, 0, col++)
  }

  col = 0
  const rightStartY = inset + th + aisleFt
  for (let y = rightStartY; y + th <= ch - inset + 1e-6; y += alongStepY) {
    push(cw - inset - tw, y, 90, 1, col++)
  }

  col = 0
  const bottomY = ch - inset - th
  for (
    let x = cw - inset - tw - alongStep;
    x >= inset - 1e-6;
    x -= alongStep
  ) {
    push(x, bottomY, 0, 2, col++)
  }

  col = 0
  const leftMaxY = ch - inset - th - alongStepY
  for (let y = leftMaxY; y >= rightStartY - 1e-6; y -= alongStepY) {
    push(inset, y, 90, 3, col++)
  }

  return slots
}

export function maxPerimeterTableCapacity(
  marketWidthFt: number,
  marketHeightFt: number,
  tableWidthFt: number,
  tableHeightFt: number,
  aisleWidthFt = DEFAULT_AISLE_WIDTH_FT,
  wallInsetFt = DEFAULT_WALL_INSET_FT
): number {
  return buildPerimeterSlots(
    marketWidthFt,
    marketHeightFt,
    tableWidthFt,
    tableHeightFt,
    aisleWidthFt,
    wallInsetFt
  ).length
}

function orderSlotsWithPremium(
  slots: SlotCandidate[],
  premium: ReadonlyArray<MarketLayoutPoint> | undefined
): SlotCandidate[] {
  if (!premium?.length) return slots
  const remaining = [...slots]
  const ordered: SlotCandidate[] = []
  for (const p of premium) {
    let bestIdx = -1
    let bestDist = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i]!
      const d = Math.hypot(s.x - p.x, s.y - p.y)
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    if (bestIdx >= 0) {
      ordered.push(remaining.splice(bestIdx, 1)[0]!)
    }
  }
  return [...ordered, ...remaining]
}

export function placementsToJson(
  placements: ReadonlyArray<MarketLayoutTablePlacement>
): MarketLayoutPlacementJson[] {
  return placements.map((p) => ({
    id: p.tableId,
    x: p.x,
    y: p.y,
    rotation: p.rotation,
    row: p.row,
    column: p.column,
    aisleSpacing: p.aisleSpacingFt,
    layoutMode: p.layoutMode,
  }))
}

/** Assign `tableCount` booths across all valid slots (skip blocked slots, keep scanning). */
function fillPlacementsFromSlots(
  ordered: ReadonlyArray<SlotCandidate>,
  tableCount: number,
  tableIds: ReadonlyArray<string>,
  tw: number,
  th: number,
  cw: number,
  ch: number,
  inset: number,
  aisleFt: number,
  layoutMode: MarketLayoutMode,
  restrictedZones: ReadonlyArray<MarketLayoutRect>
): MarketLayoutTablePlacement[] {
  const placements: MarketLayoutTablePlacement[] = []
  let tableIdx = 0
  for (const slot of ordered) {
    if (tableIdx >= tableCount) break
    const rect = tableRect(slot.x, slot.y, tw, th, slot.rotation)
    if (!fitsBounds(rect, cw, ch, inset) || hitsRestricted(rect, restrictedZones)) {
      continue
    }
    placements.push(
      toTablePlacement(tableIds[tableIdx]!, slot, aisleFt, layoutMode)
    )
    tableIdx++
  }
  return placements
}

function toTablePlacement(
  tableId: string,
  slot: SlotCandidate,
  aisleFt: number,
  layoutMode: MarketLayoutMode
): MarketLayoutTablePlacement {
  return {
    tableId,
    x: slot.x,
    y: slot.y,
    rotation: slot.rotation,
    row: slot.row + 1,
    column: slot.column + 1,
    aisleSpacingFt: aisleFt,
    layoutMode,
  }
}

function buildAsciiDiagram(
  cw: number,
  ch: number,
  placements: ReadonlyArray<MarketLayoutTablePlacement>,
  tw: number,
  th: number
): string {
  const cols = Math.min(72, Math.max(24, Math.ceil(cw)))
  const rows = Math.min(36, Math.max(12, Math.ceil(ch * (cols / cw))))
  const grid: string[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => '.')
  )

  for (const p of placements) {
    const gx = Math.floor((p.x / cw) * cols)
    const gy = Math.floor((p.y / ch) * rows)
    const gw = Math.max(1, Math.ceil((tw / cw) * cols))
    const gh = Math.max(1, Math.ceil((th / ch) * rows))
    const chMark =
      p.layoutMode === 'perimeter'
        ? 'P'
        : p.row % 2 === 0 && p.layoutMode === 'staggered'
          ? 'S'
          : 'T'
    for (let dy = 0; dy < gh; dy++) {
      for (let dx = 0; dx < gw; dx++) {
        const ry = Math.min(rows - 1, gy + dy)
        const rx = Math.min(cols - 1, gx + dx)
        grid[ry]![rx] = chMark
      }
    }
  }

  const border = '+'.padEnd(cols + 2, '-')
  return [border, ...grid.map((r) => '|' + r.join('') + '|'), border].join('\n')
}

function buildExplanation(
  layoutMode: MarketLayoutMode,
  cw: number,
  ch: number,
  tw: number,
  th: number,
  aisleFt: number,
  inset: number,
  placed: number,
  entrance?: MarketLayoutPoint,
  perimeterCapacity?: number
): string {
  const rowStep = th + aisleFt
  const parts = [
    `Mode: ${layoutMode}. Market ${cw}×${ch} ft; tables ${tw}×${th} ft.`,
    `Aisle spacing ${aisleFt} ft (straight continuous rows); wall inset ${inset} ft.`,
    `Grid snap: ${tw} ft × ${th} ft cells; rotations 0° or 90° only.`,
  ]
  if (entrance) {
    parts.push(
      `Row 1 anchored nearest entrance at (${entrance.x.toFixed(1)}, ${entrance.y.toFixed(1)}).`
    )
  }
  if (layoutMode === 'grid') {
    parts.push(
      `Rows front→back along Y; columns left→right along X; row pitch ${rowStep} ft.`
    )
  } else if (layoutMode === 'staggered') {
    parts.push(
      'Odd rows (1,3,5…) at min X; even rows (2,4,6…) offset by half table width.'
    )
  } else if (perimeterCapacity != null) {
    parts.push(
      `Perimeter ribbon clockwise (top→right→bottom→left); capacity ${perimeterCapacity}; placed ${placed}.`
    )
  }
  return parts.join(' ')
}

/**
 * Primary entry — canonical `MarketLayoutRequest` schema (Section I).
 */
export function computeMarketLayout(
  request: MarketLayoutRequest
): DeterministicMarketLayoutResult {
  const cw = request.marketDimensions.width
  const ch = request.marketDimensions.height
  const tw = request.tableDimensions.width
  const th = request.tableDimensions.height
  const tableCount = request.totalTables
  const tableIds =
    request.tableIds?.length === tableCount
      ? [...request.tableIds]
      : defaultTableIds(tableCount)
  const aisleFt = request.aisleSpacing ?? DEFAULT_AISLE_WIDTH_FT
  const inset = request.wallInsetFt ?? DEFAULT_WALL_INSET_FT
  const { entrance, restrictedZones } = parseConstraints(request.constraints)

  return runLayout({
    cw,
    ch,
    tw,
    th,
    tableCount,
    tableIds,
    layoutMode: request.layoutMode,
    aisleFt,
    inset,
    entrance,
    restrictedZones,
    premiumLocations: request.premiumLocations,
  })
}

function requestFromLegacy(
  input: DeterministicMarketLayoutInput
): MarketLayoutRequest {
  const constraints: Array<{
    type: LayoutConstraintType
    bounds: MarketLayoutPoint[]
  }> = []
  if (input.entrance) {
    constraints.push({
      type: 'entrance',
      bounds: [input.entrance],
    })
  }
  for (const z of input.restrictedZones ?? []) {
    constraints.push({
      type: 'restricted_zone',
      bounds: [
        { x: z.x, y: z.y },
        { x: z.x + z.width, y: z.y },
        { x: z.x + z.width, y: z.y + z.height },
        { x: z.x, y: z.y + z.height },
      ],
    })
  }
  return {
    marketDimensions: {
      width: input.marketWidthFt,
      height: input.marketHeightFt,
    },
    tableDimensions: {
      width: input.tableWidthFt,
      height: input.tableHeightFt,
    },
    totalTables: input.tableCount,
    tableIds: input.tableIds,
    layoutMode: input.layoutMode,
    aisleSpacing: input.aisleWidthFt,
    wallInsetFt: input.wallInsetFt,
    constraints,
    premiumLocations: input.premiumLocations,
  }
}

function runLayout(params: {
  cw: number
  ch: number
  tw: number
  th: number
  tableCount: number
  tableIds: string[]
  layoutMode: MarketLayoutMode
  aisleFt: number
  inset: number
  entrance?: MarketLayoutPoint
  restrictedZones: MarketLayoutRect[]
  premiumLocations?: ReadonlyArray<MarketLayoutPoint>
}): DeterministicMarketLayoutResult {
  const {
    cw,
    ch,
    tw,
    th,
    tableCount,
    tableIds,
    layoutMode,
    aisleFt,
    inset,
    entrance,
    restrictedZones,
    premiumLocations,
  } = params

  if (tableCount < 0 || tableIds.length < tableCount) {
    return {
      ok: false,
      error: 'tableIds must provide at least totalTables entries.',
      maxPerimeterCapacity: 0,
      layoutMode: 'perimeter',
    }
  }

  if (layoutMode === 'perimeter') {
    const perimeterSlots = buildPerimeterSlots(cw, ch, tw, th, aisleFt, inset)
    const validPerimeterSlots = perimeterSlots.filter((slot) => {
      const rect = tableRect(slot.x, slot.y, tw, th, slot.rotation)
      return (
        fitsBounds(rect, cw, ch, inset) &&
        !hitsRestricted(rect, restrictedZones)
      )
    })
    const capacity = validPerimeterSlots.length
    if (tableCount > capacity) {
      return {
        ok: false,
        error: `Perimeter capacity exceeded: requested ${tableCount} tables but maximum ${capacity} fit with ${aisleFt} ft aisle spacing.`,
        maxPerimeterCapacity: capacity,
        layoutMode: 'perimeter',
      }
    }
    const ordered = orderSlotsWithPremium(
      validPerimeterSlots,
      premiumLocations
    )
    const placements = fillPlacementsFromSlots(
      ordered,
      tableCount,
      tableIds,
      tw,
      th,
      cw,
      ch,
      inset,
      aisleFt,
      'perimeter',
      restrictedZones
    )
    return {
      ok: true,
      placements,
      layoutSlotCandidates: ordered,
      jsonPlacements: placementsToJson(placements),
      asciiDiagram: buildAsciiDiagram(cw, ch, placements, tw, th),
      explanation: buildExplanation(
        'perimeter',
        cw,
        ch,
        tw,
        th,
        aisleFt,
        inset,
        placements.length,
        entrance,
        capacity
      ),
      layoutMode: 'perimeter',
      perimeterCapacity: capacity,
    }
  }

  const interiorSlots = buildInteriorSlots(
    cw,
    ch,
    tw,
    th,
    aisleFt,
    inset,
    layoutMode === 'staggered' ? 'staggered' : 'grid',
    entrance,
    restrictedZones
  )
  const ordered = orderSlotsWithPremium(interiorSlots, premiumLocations)
  const placements = fillPlacementsFromSlots(
    ordered,
    tableCount,
    tableIds,
    tw,
    th,
    cw,
    ch,
    inset,
    aisleFt,
    layoutMode,
    restrictedZones
  )

  return {
    ok: true,
    placements,
    layoutSlotCandidates: ordered,
    jsonPlacements: placementsToJson(placements),
    asciiDiagram: buildAsciiDiagram(cw, ch, placements, tw, th),
    explanation: buildExplanation(
      layoutMode,
      cw,
      ch,
      tw,
      th,
      aisleFt,
      inset,
      placements.length,
      entrance
    ),
    layoutMode,
  }
}

/** Legacy entry — delegates to `computeMarketLayout`. */
export function generateDeterministicMarketLayout(
  input: DeterministicMarketLayoutInput
): DeterministicMarketLayoutResult {
  return computeMarketLayout(requestFromLegacy(input))
}

/** Map auto-arrange mode strings onto deterministic layout modes. */
export function autoArrangeModeToMarketLayout(
  mode: 'grid' | 'staggered' | 'perimeter-only' | 'center-out' | undefined
): MarketLayoutMode | 'perimeter' {
  if (mode === 'perimeter-only') return 'perimeter'
  if (mode === 'staggered') return 'staggered'
  return 'grid'
}
