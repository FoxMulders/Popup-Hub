import { BOOTH_EDGE_CLEARANCE_CELLS } from '@/lib/booth-planner/layout-clearance-constants'
import type { PlacementGrid } from '@/lib/booth-planner/accessible-placement'

export { BOOTH_EDGE_CLEARANCE_CELLS, BOOTH_EDGE_CLEARANCE_FT } from '@/lib/booth-planner/layout-clearance-constants'

/** True when the uniform clearance ring around a booth overlaps occupied or blocked cells. */
export function boothClearanceRingViolates(
  grid: PlacementGrid,
  startRow: number,
  startCol: number,
  rowSpan: number,
  colSpan: number,
  marginCells: number = BOOTH_EDGE_CLEARANCE_CELLS,
  walkway?: Set<string>
): boolean {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  if (rows === 0 || cols === 0) return true

  const coreR0 = startRow
  const coreR1 = startRow + rowSpan - 1
  const coreC0 = startCol
  const coreC1 = startCol + colSpan - 1

  const ringR0 = coreR0 - marginCells
  const ringR1 = coreR1 + marginCells
  const ringC0 = coreC0 - marginCells
  const ringC1 = coreC1 + marginCells

  for (let r = ringR0; r <= ringR1; r++) {
    for (let c = ringC0; c <= ringC1; c++) {
      if (r >= coreR0 && r <= coreR1 && c >= coreC0 && c <= coreC1) continue
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue
      if (grid[r][c] !== 'empty') {
        if (walkway?.has(`${r}-${c}`)) continue
        return true
      }
    }
  }
  return false
}
