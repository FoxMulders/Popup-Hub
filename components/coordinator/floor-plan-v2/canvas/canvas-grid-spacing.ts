import type { LayoutBaselineTableLengthFt } from '@/lib/booth-planner/layout-table-size'

export interface CanvasGridSpacingConfig {
  /** Minor grid line spacing in feet (matches snap increment). */
  minorFt: number
  /** Draw a major grid line every N minor cells. */
  majorEvery: number
}

/**
 * Visual + snap grid tuned to the active TABLE SIZE pill.
 * 6′–8′ tables → 1′ cells; larger halls → 2′ cells so the mesh stays readable.
 */
export function canvasGridSpacingForTableFt(
  tableLengthFt: LayoutBaselineTableLengthFt | number
): CanvasGridSpacingConfig {
  const ft = tableLengthFt
  if (ft <= 8) {
    return { minorFt: 1, majorEvery: 5 }
  }
  if (ft <= 12) {
    return { minorFt: 2, majorEvery: 5 }
  }
  return { minorFt: 2, majorEvery: 6 }
}
