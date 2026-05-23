import { BOOTH_EDGE_CLEARANCE_CELLS } from '@/lib/booth-planner/layout-clearance-constants'

export type CompositeFootprintCell = {
  r: number
  c: number
  type: 'booth' | 'buffer'
}

/** Symmetrical clearance ring on all four straight edges. */
export const COMPOSITE_BUFFER_CELLS = BOOTH_EDGE_CLEARANCE_CELLS

const TYPE_PRIORITY: Record<CompositeFootprintCell['type'], number> = {
  booth: 2,
  buffer: 1,
}

function inBounds(r: number, c: number, rows: number, cols: number): boolean {
  return r >= 0 && c >= 0 && r < rows && c < cols
}

/** Equipment core + uniform 2′ buffer on every side, clipped to grid bounds. */
export function calculateCompositeFootprint(
  boothRow: number,
  boothCol: number,
  rowSpan: number,
  colSpan: number,
  rows: number,
  cols: number
): CompositeFootprintCell[] {
  const cellMap = new Map<string, CompositeFootprintCell>()

  const add = (r: number, c: number, type: CompositeFootprintCell['type']) => {
    if (!inBounds(r, c, rows, cols)) return
    const key = `${r}-${c}`
    const existing = cellMap.get(key)
    if (!existing || TYPE_PRIORITY[type] > TYPE_PRIORITY[existing.type]) {
      cellMap.set(key, { r, c, type })
    }
  }

  for (let dr = 0; dr < rowSpan; dr++) {
    for (let dc = 0; dc < colSpan; dc++) {
      add(boothRow + dr, boothCol + dc, 'booth')
    }
  }

  for (let dr = -COMPOSITE_BUFFER_CELLS; dr < rowSpan + COMPOSITE_BUFFER_CELLS; dr++) {
    for (let dc = -COMPOSITE_BUFFER_CELLS; dc < colSpan + COMPOSITE_BUFFER_CELLS; dc++) {
      if (dr >= 0 && dr < rowSpan && dc >= 0 && dc < colSpan) continue
      add(boothRow + dr, boothCol + dc, 'buffer')
    }
  }

  return Array.from(cellMap.values())
}
