import type { BoothCell, VenueElement } from '@/types/database'
import {
  PERIMETER_VENDING_MARGIN_CELLS,
  isOuterPerimeterCell,
} from '@/lib/booth-planner/perimeter-clearance'
import { buildOutsideOnlyVenueShell } from '@/lib/booth-planner/expo-floor-shell'
import type { WallSide } from '@/lib/booth-planner/venue-elements'

export interface OutsideOnlyLayoutPatch {
  venue_elements: VenueElement[]
  cells: BoothCell[]
}

/** Outside-only: expo shell without interior spine — 4′ margin open for perimeter vendors. */
export function buildOutsideOnlyVenueElements(
  cols: number,
  rows: number,
  entrance: WallSide
): VenueElement[] {
  return buildOutsideOnlyVenueShell(cols, rows, entrance)
}

/** Wipe booth placements and paint a fresh outside-only perimeter shell. */
export function applyOutsideOnlyLayout(
  cols: number,
  rows: number,
  entrance: WallSide
): OutsideOnlyLayoutPatch {
  return {
    venue_elements: buildOutsideOnlyVenueElements(cols, rows, entrance),
    cells: [],
  }
}

/** Cells in the 4′ vending margin (for placement ordering). */
export function perimeterVendingLaneOrigins(
  cols: number,
  rows: number,
  entrance: WallSide
): [number, number][] {
  if (cols < 1 || rows < 1) return []

  const m = PERIMETER_VENDING_MARGIN_CELLS
  const seen = new Set<string>()
  const order: [number, number][] = []
  const add = (r: number, c: number) => {
    const key = `${r}-${c}`
    if (
      r < 0 ||
      c < 0 ||
      r >= rows ||
      c >= cols ||
      seen.has(key) ||
      isOuterPerimeterCell(r, c, cols, rows)
    ) {
      return
    }
    if (r > m && r < rows - 1 - m && c > m && c < cols - 1 - m) return
    seen.add(key)
    order.push([r, c])
  }

  const southBand = () => {
    for (let r = 1; r <= m; r++) for (let c = 1; c < cols - 1; c++) add(r, c)
  }
  const northBand = () => {
    for (let r = rows - 1 - m; r <= rows - 2; r++)
      for (let c = cols - 2; c >= 1; c--) add(r, c)
  }
  const eastBand = () => {
    for (let c = cols - 1 - m; c <= cols - 2; c++)
      for (let r = rows - 2 - m; r >= m + 1; r--) add(r, c)
  }
  const westBand = () => {
    for (let c = 1; c <= m; c++) for (let r = rows - 2 - m; r >= m + 1; r--) add(r, c)
  }

  const segments: (() => void)[] = []
  if (entrance === 'south') segments.push(southBand, eastBand, northBand, westBand)
  else if (entrance === 'north') segments.push(northBand, westBand, southBand, eastBand)
  else if (entrance === 'west') segments.push(westBand, southBand, eastBand, northBand)
  else segments.push(eastBand, southBand, westBand, northBand)

  for (const run of segments) run()
  return order
}
