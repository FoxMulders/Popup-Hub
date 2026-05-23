import type { LayoutSpacingMode } from '@/types/database'
import {
  BOOTH_EQUIPMENT_DEPTH_FT,
  marketUnitGridSpans,
  tableFootprintToGridSpans,
} from '@/lib/booth-planner/table-space'

/** Table length axis on the layout grid. */
export type TableOrientation = 'horizontal' | 'vertical'

/** Booth footprint for a table length and orientation. */
export function gridSpansForTableOrientation(
  tableLengthFt: number,
  spacingMode: LayoutSpacingMode,
  orientation: TableOrientation = 'horizontal'
): { colSpan: number; rowSpan: number } {
  if (spacingMode === 'one_foot') {
    const L = Math.max(1, Math.round(tableLengthFt))
    if (orientation === 'horizontal') {
      return { colSpan: L, rowSpan: BOOTH_EQUIPMENT_DEPTH_FT }
    }
    return { colSpan: BOOTH_EQUIPMENT_DEPTH_FT, rowSpan: L }
  }

  if (spacingMode === 'table_provided') {
    const defaultSpans = tableFootprintToGridSpans(tableLengthFt)
    if (orientation === 'vertical') {
      return defaultSpans
    }
    return { colSpan: defaultSpans.rowSpan, rowSpan: defaultSpans.colSpan }
  }

  return { colSpan: 1, rowSpan: 1 }
}

/** Infer orientation from footprint spans (1′ grid or table-provided). */
export function inferTableOrientation(
  colSpan: number,
  rowSpan: number,
  tableLengthFt?: number
): TableOrientation {
  const L = tableLengthFt != null ? Math.max(1, Math.round(tableLengthFt)) : null
  if (L != null) {
    if (colSpan === L && rowSpan !== L) return 'horizontal'
    if (rowSpan === L && colSpan !== L) return 'vertical'
    if (colSpan === BOOTH_EQUIPMENT_DEPTH_FT && rowSpan === L) return 'vertical'
    if (rowSpan === BOOTH_EQUIPMENT_DEPTH_FT && colSpan === L) return 'horizontal'
  }
  return colSpan >= rowSpan ? 'horizontal' : 'vertical'
}

export function toggleTableOrientation(o: TableOrientation): TableOrientation {
  return o === 'horizontal' ? 'vertical' : 'horizontal'
}

export function tableOrientationLabel(o: TableOrientation): string {
  return o === 'horizontal' ? 'L ↔ E-W' : 'L ↕ N-S'
}

/** Default horizontal spans (legacy alias). */
export function defaultTableGridSpans(tableLengthFt: number): {
  colSpan: number
  rowSpan: number
} {
  return marketUnitGridSpans(tableLengthFt)
}
