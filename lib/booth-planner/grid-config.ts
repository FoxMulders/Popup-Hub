import type { LayoutSpacingMode } from '@/lib/booth-planner/table-space'
import { computeGridScale, type GridScaleInfo } from '@/lib/booth-planner/grid-scale'

export const ONE_FOOT_CELL_FT = 1

/** Warn when 1′ grid exceeds this many cells (performance guardrail). */
export const HIGH_RES_GRID_CELL_WARN_THRESHOLD = 12_000

export interface ResolvedGridConfig extends GridScaleInfo {
  spacingMode: LayoutSpacingMode
  cellPx: number
  totalCells: number
  isHighResolution: boolean
}

export function resolveGridConfig(input: {
  venueWidthFt: number
  venueLengthFt: number
  boothWidthFt: number
  boothLengthFt: number
  spacingMode: LayoutSpacingMode
}): ResolvedGridConfig {
  const { venueWidthFt, venueLengthFt, spacingMode } = input

  if (spacingMode === 'one_foot') {
    const cols = Math.max(1, Math.floor(venueWidthFt / ONE_FOOT_CELL_FT))
    const rows = Math.max(1, Math.floor(venueLengthFt / ONE_FOOT_CELL_FT))
    const gridWidthFt = cols * ONE_FOOT_CELL_FT
    const gridLengthFt = rows * ONE_FOOT_CELL_FT
    return {
      spacingMode,
      cellWidthFt: ONE_FOOT_CELL_FT,
      cellLengthFt: ONE_FOOT_CELL_FT,
      cols,
      rows,
      gridWidthFt,
      gridLengthFt,
      venueWidthFt,
      venueLengthFt,
      widthRemainderFt: Math.max(0, venueWidthFt - gridWidthFt),
      lengthRemainderFt: Math.max(0, venueLengthFt - gridLengthFt),
      cellPx: 22,
      totalCells: cols * rows,
      isHighResolution: true,
    }
  }

  const scale = computeGridScale(
    venueWidthFt,
    venueLengthFt,
    input.boothWidthFt,
    input.boothLengthFt
  )

  return {
    ...scale,
    spacingMode,
    cellPx: spacingMode === 'table_provided' ? 28 : 72,
    totalCells: scale.cols * scale.rows,
    isHighResolution: spacingMode === 'table_provided',
  }
}
