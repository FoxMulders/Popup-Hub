import type { VenueElement } from '@/types/database'
import { cellsOfElement } from '@/lib/booth-planner/perimeter-clearance'

/** Directional keep-out depth from emergency exits (6′). */
export const EXIT_KEEPOUT_DEPTH_CELLS = 6

function cellKey(row: number, col: number): string {
  return `${row}-${col}`
}

function exitConeDirection(
  el: VenueElement,
  cols: number,
  rows: number
): { dr: number; dc: number } | null {
  const spanC = el.colSpan ?? 1
  const spanR = el.rowSpan ?? 1
  const centerRow = el.row + Math.floor(spanR / 2)
  const centerCol = el.col + Math.floor(spanC / 2)

  if (centerRow <= 1) return { dr: 1, dc: 0 }
  if (centerRow >= rows - 2) return { dr: -1, dc: 0 }
  if (centerCol <= 1) return { dr: 0, dc: 1 }
  if (centerCol >= cols - 2) return { dr: 0, dc: -1 }
  return null
}

/** 6′ directional cone from each exit center — modest width at the far end only. */
export function collectExitKeepoutZoneKeys(
  elements: VenueElement[],
  cols: number,
  rows: number
): Set<string> {
  const keys = new Set<string>()
  for (const el of elements) {
    if (el.type !== 'exit') continue
    const dir = exitConeDirection(el, cols, rows)
    if (!dir) continue

    const spanC = el.colSpan ?? 1
    const spanR = el.rowSpan ?? 1
    let r = el.row + Math.floor(spanR / 2)
    let c = el.col + Math.floor(spanC / 2)

    for (let step = 1; step <= EXIT_KEEPOUT_DEPTH_CELLS; step++) {
      r += dir.dr
      c += dir.dc
      if (r < 0 || c < 0 || r >= rows || c >= cols) break
      const spread = step >= EXIT_KEEPOUT_DEPTH_CELLS - 1 ? 1 : 0
      for (let dr = -spread; dr <= spread; dr++) {
        for (let dc = -spread; dc <= spread; dc++) {
          const nr = r + dr
          const nc = c + dc
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            keys.add(cellKey(nr, nc))
          }
        }
      }
    }
  }
  return keys
}
