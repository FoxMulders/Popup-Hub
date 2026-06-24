import type { PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'

export const DEFAULT_FOOD_COURT_WIDTH_FT = 16
export const DEFAULT_FOOD_COURT_DEPTH_FT = 12

export function defaultFoodCourtFootprintFt(): { width: number; height: number } {
  return {
    width: DEFAULT_FOOD_COURT_WIDTH_FT,
    height: DEFAULT_FOOD_COURT_DEPTH_FT,
  }
}

export function nextFoodCourtLabel(objects: ReadonlyArray<PlacedObject>): string {
  const count = objects.filter((o) => o.kind === 'food_court').length
  return count === 0 ? 'Food court' : `Food court ${count + 1}`
}
