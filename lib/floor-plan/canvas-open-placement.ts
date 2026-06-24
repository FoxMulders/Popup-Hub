/**
 * Canvas-open placement — fixtures that may sit anywhere on the advisory
 * canvas bounds (parking lots, curbside food trucks) without requiring
 * a room interior or perimeter touch.
 */

import type { ObjectKind } from '@/components/coordinator/floor-plan-v2/state/types'
import type { PlacementProbe } from '@/components/coordinator/floor-plan-v2/geometry/is-point-in-room'
import type { FloorPlanDoc, PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  aabbFitsCanvas,
  placedObjectsOverlap,
} from '@/components/coordinator/floor-plan-v2/interactions/geometry'

/** Default tap-to-place footprint (typical box truck). */
export const DEFAULT_FOOD_TRUCK_WIDTH_FT = 8
export const DEFAULT_FOOD_TRUCK_LENGTH_FT = 20

export const CANVAS_OPEN_PLACEMENT_KINDS: ReadonlySet<ObjectKind> = new Set<ObjectKind>([
  'food_truck',
  'food_court',
  'stage',
  'amenity',
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

function placementProbeAsObject(
  obj: PlacementProbe,
  id = '__canvas_open_probe__'
): PlacedObject {
  return {
    id,
    kind: obj.kind,
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    rotation: obj.rotation ?? 0,
  } as PlacedObject
}

/** True when a canvas-open object intersects any solid wall barrier. */
export function canvasOpenPlacementOverlapsWall(
  doc: FloorPlanDoc,
  obj: PlacementProbe,
  excludeIds?: ReadonlySet<string>
): boolean {
  if (!isCanvasOpenPlacementKind(obj.kind)) return false
  const probe = placementProbeAsObject(obj)
  for (const other of doc.objects) {
    if (excludeIds?.has(other.id)) continue
    if (other.kind !== 'wall') continue
    if (placedObjectsOverlap(probe, other)) return true
  }
  return false
}

export function isValidCanvasOpenPlacement(
  doc: FloorPlanDoc,
  obj: PlacementProbe,
  excludeIds?: ReadonlySet<string>
): boolean {
  if (!isCanvasOpenPlacementKind(obj.kind)) return false
  if (!objectFitsCanvas(doc, obj)) return false
  if (canvasOpenPlacementOverlapsWall(doc, obj, excludeIds)) return false
  return true
}
