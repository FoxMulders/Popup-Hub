import type { LayoutBaselineTableLengthFt } from '@/lib/booth-planner/layout-table-size'
import {
  DEFAULT_GRID_SPACING_FT,
  DEFAULT_SNAP_FT,
} from '../state/types'

export interface CanvasGridSpacingConfig {
  /** Minor grid line spacing in feet (matches snap increment). */
  minorFt: number
  /** Draw a major grid line every N minor cells. */
  majorEvery: number
}

/** Layout designer canvas: 1′ minor cells, major line every 5′ (25′ accent rhythm). */
export const CANVAS_GRID_MAJOR_EVERY = 5

/**
 * Visual + snap grid for the v2 layout designer canvas.
 * Always 1′ per cell so room footprints (e.g. 50′ × 50′) align with grid subdivisions
 * regardless of vendor table size preset.
 */
export function canvasGridSpacingForTableFt(
  _tableLengthFt?: LayoutBaselineTableLengthFt | number
): CanvasGridSpacingConfig {
  return {
    minorFt: DEFAULT_GRID_SPACING_FT,
    majorEvery: CANVAS_GRID_MAJOR_EVERY,
  }
}

/** Document fields to keep grid rendering and pointer snap in sync. */
export function canvasGridDocPatch(): {
  gridSpacingFt: number
  snapFt: number
} {
  return {
    gridSpacingFt: DEFAULT_GRID_SPACING_FT,
    snapFt: DEFAULT_SNAP_FT,
  }
}
