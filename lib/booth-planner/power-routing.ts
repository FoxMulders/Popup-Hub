import type { VenueElement } from '@/types/database'
import { cellsOfElement, isOuterPerimeterCell } from '@/lib/booth-planner/perimeter-clearance'

const POWER_PROXY_TYPES = new Set<VenueElement['type']>([
  'food_court',
  'loading_dock',
  'info_desk',
  'column',
])

export function requiresPowerVendor(requestedBoothType: string | null | undefined): boolean {
  return requestedBoothType === 'power'
}

/** Perimeter wall cells and outlet-proxy fixtures. */
export function collectPowerRoutingTargets(
  elements: VenueElement[],
  cols: number,
  rows: number
): Set<string> {
  const keys = new Set<string>()
  for (const el of elements) {
    if (POWER_PROXY_TYPES.has(el.type)) {
      for (const { row, col } of cellsOfElement(el)) {
        keys.add(`${row}-${col}`)
      }
    }
    if (el.type === 'column') {
      for (const { row, col } of cellsOfElement(el)) {
        if (isOuterPerimeterCell(row, col, cols, rows)) {
          keys.add(`${row}-${col}`)
        }
      }
    }
  }
  return keys
}

export function powerRoutingScore(
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  targets: Set<string>
): number {
  let minDist = 999
  const cr = row + rowSpan / 2
  const cc = col + colSpan / 2
  for (const key of targets) {
    const [r, c] = key.split('-').map(Number)
    const dist = Math.abs(r - cr) + Math.abs(c - cc)
    if (dist < minDist) minDist = dist
  }
  if (minDist >= 999) return 0
  return Math.max(0, 600 - minDist * 40)
}
