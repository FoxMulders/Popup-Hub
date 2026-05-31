/**
 * Deterministic market table layout for PopupHub.ca.
 *
 * Modes: grid | staggered | perimeter
 * — No randomness; identical inputs always yield identical outputs.
 * — Tables snap to a uniform grid; aisles default to 8 ft between rows.
 * — Rotations are 0° or 90° only (perimeter uses edge-aligned rotation).
 */

export type MarketLayoutMode = 'grid' | 'staggered' | 'perimeter'

export interface MarketLayoutPoint {
  x: number
  y: number
}

export interface MarketLayoutRect {
  x: number
  y: number
  width: number
  height: number
}

export interface DeterministicMarketLayoutInput {
  /** Usable market width (ft). */
  marketWidthFt: number
  /** Usable market height (ft). */
  marketHeightFt: number
  tableWidthFt: number
  tableHeightFt: number
  tableCount: number
  /** Table ids in placement order (length must equal tableCount). */
  tableIds: ReadonlyArray<string>
  layoutMode: MarketLayoutMode
  /** Minimum aisle width between rows / along perimeter (ft). Default 8. */
  aisleWidthFt?: number
  /** Inset from market boundary (ft). Default 3.5. */
  wallInsetFt?: number
  /** Snap coordinates to this grid (ft). Default 0.5. */
  snapFt?: number
  /** Main entrance — first row is placed closest to this point. */
  entrance?: MarketLayoutPoint
  /** Zones where tables may not be placed. */
  restrictedZones?: ReadonlyArray<MarketLayoutRect>
  /** Premium anchor points — nearest slots are filled first. */
  premiumLocations?: ReadonlyArray<MarketLayoutPoint>
}

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
export const DEFAULT_SNAP_FT = 0.5

interface SlotCandidate {
  x: number
  y: number
  row: number
  column: number
  rotation: 0 | 90
  perimeterSequence?: number
}

function snapFtValue(n: number, snap: number): number {
  if (snap <= 0) return n
  return Math.round(n / snap) * snap
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

/** Rows start at the edge nearest the entrance (first row = front). */
function rowOriginY(
  entrance: MarketLayoutPoint | undefined,
  ch: number,
  inset: number,
  tableH: number,
  rowIndex: number,
  rowStep: number
): number {
  const frontAtBottom =
    entrance != null ? entrance.y > ch / 2 : false
  if (frontAtBottom) {
    return ch - inset - tableH - rowIndex * rowStep
  }
  return inset + rowIndex * rowStep
}

function buildInteriorSlots(
  input: DeterministicMarketLayoutInput,
  mode: 'grid' | 'staggered'
): SlotCandidate[] {
  const {
    marketWidthFt: cw,
    marketHeightFt: ch,
    tableWidthFt: tw,
    tableHeightFt: th,
    aisleWidthFt = DEFAULT_AISLE_WIDTH_FT,
    wallInsetFt = DEFAULT_WALL_INSET_FT,
    snapFt = DEFAULT_SNAP_FT,
    entrance,
    restrictedZones = [],
  } = input

  const rowStep = th + aisleWidthFt
  const colStep = tw
  const slots: SlotCandidate[] = []
  let row = 0

  while (true) {
    const y = snapFtValue(
      rowOriginY(entrance, ch, wallInsetFt, th, row, rowStep),
      snapFt
    )
    if (y + th > ch - wallInsetFt + 1e-6) break
    if (y < wallInsetFt - 1e-6) break

    const staggerOffset =
      mode === 'staggered' && row % 2 === 1 ? tw / 2 : 0
    let col = 0
    let x = snapFtValue(wallInsetFt + staggerOffset, snapFt)

    while (x + tw <= cw - wallInsetFt + 1e-6) {
      const rect = tableRect(x, y, tw, th, 0)
      if (
        fitsBounds(rect, cw, ch, wallInsetFt) &&
        !hitsRestricted(rect, restrictedZones)
      ) {
        slots.push({ x, y, row, column: col, rotation: 0 })
      }
      col++
      x = snapFtValue(x + colStep, snapFt)
    }

    row++
    const nextY = rowOriginY(entrance, ch, wallInsetFt, th, row, rowStep)
    if (entrance != null && entrance.y > ch / 2) {
      if (nextY < wallInsetFt - 1e-6) break
    } else if (nextY + th > ch - wallInsetFt + 1e-6) {
      break
    }
    if (row > 5000) break
  }

  return slots
}

/** Perimeter slot order: top L→R, right T→B, bottom R→L, left B→T. */
function buildPerimeterSlots(
  cw: number,
  ch: number,
  tw: number,
  th: number,
  aisleFt: number,
  inset: number,
  snap: number
): SlotCandidate[] {
  const alongStep = tw + aisleFt
  const alongStepY = th + aisleFt
  const slots: SlotCandidate[] = []
  let seq = 0

  const push = (
    x: number,
    y: number,
    rotation: 0 | 90,
    row: number,
    column: number
  ) => {
    slots.push({
      x: snapFtValue(x, snap),
      y: snapFtValue(y, snap),
      row,
      column,
      rotation,
      perimeterSequence: seq++,
    })
  }

  let col = 0
  for (let x = inset; x + tw <= cw - inset + 1e-6; x += alongStep) {
    push(x, inset, 0, 0, col++)
  }

  const topCount = col
  col = 0
  const rightStartY = inset + th + aisleFt
  for (let y = rightStartY; y + th <= ch - inset + 1e-6; y += alongStepY) {
    push(cw - inset - tw, y, 90, 1, col++)
  }

  const rightCount = col
  col = 0
  const bottomY = ch - inset - th
  for (
    let x = cw - inset - tw - alongStep;
    x >= inset - 1e-6;
    x -= alongStep
  ) {
    push(x, bottomY, 0, 2, col++)
  }

  const bottomCount = col
  col = 0
  const leftMaxY = ch - inset - th - alongStepY
  for (let y = leftMaxY; y >= rightStartY - 1e-6; y -= alongStepY) {
    push(inset, y, 90, 3, col++)
  }

  void topCount
  void rightCount
  void bottomCount
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
    wallInsetFt,
    DEFAULT_SNAP_FT
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
        : p.row % 2 === 1 && p.layoutMode === 'staggered'
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
  const lines = [border, ...grid.map((r) => '|' + r.join('') + '|'), border]
  return lines.join('\n')
}

function buildExplanation(
  input: DeterministicMarketLayoutInput,
  placed: number,
  aisleFt: number,
  inset: number,
  perimeterCapacity?: number
): string {
  const { layoutMode, marketWidthFt, marketHeightFt, tableWidthFt, tableHeightFt } =
    input
  const rowStep = tableHeightFt + aisleFt
  const parts = [
    `Mode: ${layoutMode}. Market ${marketWidthFt}×${marketHeightFt} ft, tables ${tableWidthFt}×${tableHeightFt} ft.`,
    `Wall inset ${inset} ft; aisle ${aisleFt} ft between rows (and along perimeter).`,
    `Row pitch ${rowStep} ft; column pitch ${tableWidthFt} ft.`,
  ]
  if (input.entrance) {
    parts.push(
      `Entrance at (${input.entrance.x}, ${input.entrance.y}) — row 0 is closest to that point.`
    )
  }
  if (layoutMode === 'staggered') {
    parts.push('Odd rows offset by half table width for alternating visibility.')
  }
  if (layoutMode === 'perimeter' && perimeterCapacity != null) {
    parts.push(
      `Perimeter capacity ${perimeterCapacity} slots (top→right→bottom→left). Placed ${placed}.`
    )
  } else {
    parts.push(`Placed ${placed} table(s) in row-major order (left→right, front→back).`)
  }
  return parts.join(' ')
}

/**
 * Generate a deterministic market layout from explicit dimensions and mode.
 */
export function generateDeterministicMarketLayout(
  input: DeterministicMarketLayoutInput
): DeterministicMarketLayoutResult {
  const aisleFt = input.aisleWidthFt ?? DEFAULT_AISLE_WIDTH_FT
  const inset = input.wallInsetFt ?? DEFAULT_WALL_INSET_FT
  const snap = input.snapFt ?? DEFAULT_SNAP_FT
  const {
    marketWidthFt: cw,
    marketHeightFt: ch,
    tableWidthFt: tw,
    tableHeightFt: th,
    tableCount,
    tableIds,
    layoutMode,
    restrictedZones = [],
  } = input

  if (tableCount < 0 || tableIds.length < tableCount) {
    return {
      ok: false,
      error: 'tableIds must provide at least tableCount entries.',
      maxPerimeterCapacity: 0,
      layoutMode: 'perimeter',
    }
  }

  if (layoutMode === 'perimeter') {
    const perimeterSlots = buildPerimeterSlots(cw, ch, tw, th, aisleFt, inset, snap)
    const capacity = perimeterSlots.length
    if (tableCount > capacity) {
      return {
        ok: false,
        error: `Perimeter capacity exceeded: requested ${tableCount} tables but only ${capacity} fit along the boundary.`,
        maxPerimeterCapacity: capacity,
        layoutMode: 'perimeter',
      }
    }
    const ordered = orderSlotsWithPremium(
      perimeterSlots,
      input.premiumLocations
    )
    const placements: MarketLayoutTablePlacement[] = []
    for (let i = 0; i < tableCount; i++) {
      const slot = ordered[i]!
      const rect = tableRect(slot.x, slot.y, tw, th, slot.rotation)
      if (
        !fitsBounds(rect, cw, ch, inset) ||
        hitsRestricted(rect, restrictedZones)
      ) {
        continue
      }
      placements.push({
        tableId: tableIds[i]!,
        x: slot.x,
        y: slot.y,
        rotation: slot.rotation,
        row: slot.row,
        column: slot.column,
        aisleSpacingFt: aisleFt,
        layoutMode: 'perimeter',
      })
    }
    const asciiDiagram = buildAsciiDiagram(cw, ch, placements, tw, th)
    const explanation = buildExplanation(
      input,
      placements.length,
      aisleFt,
      inset,
      capacity
    )
    return {
      ok: true,
      placements,
      asciiDiagram,
      explanation,
      layoutMode: 'perimeter',
      perimeterCapacity: capacity,
    }
  }

  const interiorSlots = buildInteriorSlots(
    input,
    layoutMode === 'staggered' ? 'staggered' : 'grid'
  )
  const ordered = orderSlotsWithPremium(interiorSlots, input.premiumLocations)
  const placements: MarketLayoutTablePlacement[] = []

  for (let i = 0; i < tableCount && i < ordered.length; i++) {
    const slot = ordered[i]!
    const rect = tableRect(slot.x, slot.y, tw, th, slot.rotation)
    if (!fitsBounds(rect, cw, ch, inset) || hitsRestricted(rect, restrictedZones)) {
      continue
    }
    placements.push({
      tableId: tableIds[i]!,
      x: slot.x,
      y: slot.y,
      rotation: slot.rotation,
      row: slot.row,
      column: slot.column,
      aisleSpacingFt: aisleFt,
      layoutMode,
    })
  }

  const asciiDiagram = buildAsciiDiagram(cw, ch, placements, tw, th)
  const explanation = buildExplanation(
    input,
    placements.length,
    aisleFt,
    inset
  )

  return {
    ok: true,
    placements,
    asciiDiagram,
    explanation,
    layoutMode,
  }
}

/** Map auto-arrange mode strings onto deterministic layout modes. */
export function autoArrangeModeToMarketLayout(
  mode: 'grid' | 'staggered' | 'perimeter-only' | 'center-out' | undefined
): MarketLayoutMode | 'perimeter' {
  if (mode === 'perimeter-only') return 'perimeter'
  if (mode === 'staggered') return 'staggered'
  return 'grid'
}
