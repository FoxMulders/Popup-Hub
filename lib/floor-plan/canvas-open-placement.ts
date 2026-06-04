/**
 * Canvas-open placement — fixtures that may sit anywhere on the advisory
 * canvas bounds (parking lots, curbside food trucks) without requiring
 * a room interior or perimeter touch.
 */

import type { ObjectKind } from '@/components/coordinator/floor-plan-v2/state/types'
import type { PlacementProbe } from '@/components/coordinator/floor-plan-v2/geometry/is-point-in-room'
import type { FloorPlanDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import { aabbFitsCanvas } from '@/components/coordinator/floor-plan-v2/interactions/geometry'

/** Default tap-to-place footprint (typical box truck). */
export const DEFAULT_FOOD_TRUCK_WIDTH_FT = 8
export const DEFAULT_FOOD_TRUCK_LENGTH_FT = 20

export const CANVAS_OPEN_PLACEMENT_KINDS: ReadonlySet<ObjectKind> = new Set<ObjectKind>([
  'food_truck',
])

export function isCanvasOpenPlacementKind(
  kind: ObjectKind | undefined
): boolean {
  return kind != null && CANVAS_OPEN_PLACEMENT_KINDS.has(kind)
}

export function defaultFoodTruckFootprintFt(): {
  width: number
  height: number
} {
  return {
    width: DEFAULT_FOOD_TRUCK_WIDTH_FT,
    height: DEFAULT_FOOD_TRUCK_LENGTH_FT,
  }
}

/** True when the object's AABB lies fully inside the doc canvas. */
export function objectFitsCanvas(
  doc: Pick<FloorPlanDoc, 'canvasWidthFt' | 'canvasLengthFt'>,
  obj: Pick<PlacementProbe, 'x' | 'y' | 'width' | 'height'>
): boolean {
  return aabbFitsCanvas(
    { x: obj.x, y: obj.y, width: obj.width, height: obj.height },
    doc.canvasWidthFt,
    doc.canvasLengthFt
  )
}

export function isValidCanvasOpenPlacement(
  doc: FloorPlanDoc,
  obj: PlacementProbe
): boolean {
  if (!isCanvasOpenPlacementKind(obj.kind)) return false
  return objectFitsCanvas(doc, obj)
}
