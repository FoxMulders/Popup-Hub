import { clearanceRingCells } from '@/lib/booth-planner/co-generated-aisles'
import { BOOTH_SAFETY_BUFFER_CELLS } from '@/lib/booth-planner/layout-clearance-constants'
import { calculateCompositeFootprint } from '@/lib/booth-planner/composite-footprint'

export interface BoothRingSpec {
  id: string
  row: number
  col: number
  rowSpan: number
  colSpan: number
}

export interface ClearanceRingCell {
  r: number
  c: number
  boothId: string
  kind: 'buffer' | 'core'
}

function cellKey(r: number, c: number): string {
  return `${r}-${c}`
}

export function ringsForBooth(spec: BoothRingSpec, rows: number, cols: number): ClearanceRingCell[] {
  const cells: ClearanceRingCell[] = []
  for (const { r, c } of clearanceRingCells(spec.row, spec.col, spec.rowSpan, spec.colSpan)) {
    if (r < 0 || c < 0 || r >= rows || c >= cols) continue
    cells.push({ r, c, boothId: spec.id, kind: 'buffer' })
  }
  for (let dr = 0; dr < spec.rowSpan; dr++) {
    for (let dc = 0; dc < spec.colSpan; dc++) {
      const r = spec.row + dr
      const c = spec.col + dc
      if (r >= 0 && c >= 0 && r < rows && c < cols) {
        cells.push({ r, c, boothId: spec.id, kind: 'core' })
      }
    }
  }
  return cells
}

export function nearbyPlacedBooths(
  active: BoothRingSpec,
  placed: BoothRingSpec[],
  proximityCells: number = 8
): BoothRingSpec[] {
  const ar0 = active.row - BOOTH_SAFETY_BUFFER_CELLS
  const ar1 = active.row + active.rowSpan + BOOTH_SAFETY_BUFFER_CELLS
  const ac0 = active.col - BOOTH_SAFETY_BUFFER_CELLS
  const ac1 = active.col + active.colSpan + BOOTH_SAFETY_BUFFER_CELLS

  return placed.filter((p) => {
    if (p.id === active.id) return false
    const br1 = p.row + p.rowSpan
    const bc1 = p.col + p.colSpan
    const nearRow = p.row <= ar1 + proximityCells && br1 >= ar0 - proximityCells
    const nearCol = p.col <= ac1 + proximityCells && bc1 >= ac0 - proximityCells
    return nearRow && nearCol
  })
}

/** True when buffer rings from two booths overlap (excluding legal side-by-side shared edge). */
export function bufferRingsOverlap(
  a: BoothRingSpec,
  b: BoothRingSpec,
  rows: number,
  cols: number,
  allowSharedEdge = false
): boolean {
  const aFoot = calculateCompositeFootprint(a.row, a.col, a.rowSpan, a.colSpan, rows, cols)
  const bFoot = calculateCompositeFootprint(b.row, b.col, b.rowSpan, b.colSpan, rows, cols)

  const aBuffer = new Set(
    aFoot.filter((c) => c.type === 'buffer').map((c) => cellKey(c.r, c.c))
  )
  const bBuffer = new Set(
    bFoot.filter((c) => c.type === 'buffer').map((c) => cellKey(c.r, c.c))
  )

  if (allowSharedEdge) {
    const horizontalSnap =
      (a.col + a.colSpan === b.col || b.col + b.colSpan === a.col) &&
      a.row === b.row &&
      a.rowSpan === b.rowSpan
    const verticalSnap =
      (a.row + a.rowSpan === b.row || b.row + b.rowSpan === a.row) &&
      a.col === b.col &&
      a.colSpan === b.colSpan
    if (horizontalSnap || verticalSnap) {
      return false
    }
  }

  for (const k of aBuffer) {
    if (bBuffer.has(k)) return true
  }
  return false
}

export interface DualRingOverlayResult {
  activeRings: ClearanceRingCell[]
  targetRings: ClearanceRingCell[]
  hasOverlap: boolean
  valid: boolean
}

export function computeDualRingOverlay(input: {
  active: BoothRingSpec
  placed: BoothRingSpec[]
  rows: number
  cols: number
  allowMultiUnitSnap?: boolean
}): DualRingOverlayResult {
  const { active, placed, rows, cols, allowMultiUnitSnap = false } = input
  const neighbors = nearbyPlacedBooths(active, placed)
  const activeRings = ringsForBooth(active, rows, cols)
  const targetRings: ClearanceRingCell[] = []
  let hasOverlap = false

  for (const n of neighbors) {
    targetRings.push(...ringsForBooth(n, rows, cols))
    if (bufferRingsOverlap(active, n, rows, cols, allowMultiUnitSnap)) {
      hasOverlap = true
    }
  }

  return {
    activeRings,
    targetRings,
    hasOverlap,
    valid: !hasOverlap,
  }
}
