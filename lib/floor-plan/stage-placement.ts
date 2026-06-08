/**
 * Stage fixture placement — default footprint and auto labels for
 * repeated tap-to-stamp on the layout designer canvas.
 */

import type { PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'

/** Typical raised platform footprint (ft). */
export const DEFAULT_STAGE_WIDTH_FT = 12
export const DEFAULT_STAGE_DEPTH_FT = 8

export function defaultStageFootprintFt(): { width: number; height: number } {
  return {
    width: DEFAULT_STAGE_WIDTH_FT,
    height: DEFAULT_STAGE_DEPTH_FT,
  }
}

/** Next label for a newly stamped stage — "Stage 1", "Stage 2", … */
export function nextStageLabel(objects: ReadonlyArray<PlacedObject>): string {
  const count = objects.filter((o) => o.kind === 'stage').length
  return `Stage ${count + 1}`
}
