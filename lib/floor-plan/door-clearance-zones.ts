import { rotatedAabb, type Rect } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import type { PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'
import { PERIMETER_WALL_CLEARANCE_FT } from '@/lib/booth-planner/layout-clearance-constants'
import { edgeClearanceBetweenRects } from '@/lib/floor-plan/rect-edge-clearance'

export const DOOR_EGRESS_CLEARANCE_FT = PERIMETER_WALL_CLEARANCE_FT

const DOOR_KINDS = new Set<PlacedObject['kind']>(['door', 'emergency_exit'])

export function isDoorOrExitObject(obj: PlacedObject): boolean {
  return DOOR_KINDS.has(obj.kind)
}

/** Door/exit footprint expanded by the mandatory egress clearance (5′). */
export function doorClearanceZoneRect(
  door: PlacedObject,
  clearanceFt = DOOR_EGRESS_CLEARANCE_FT
): Rect {
  const base = rotatedAabb(door)
  return {
    x: base.x - clearanceFt,
    y: base.y - clearanceFt,
    width: base.width + clearanceFt * 2,
    height: base.height + clearanceFt * 2,
  }
}

/**
 * True when a booth footprint is within the door egress zone (≤5′ from the
 * opening). Booths farther along the same wall row are not affected.
 */
export function boothWithinDoorClearanceZone(
  boothRect: Rect,
  door: PlacedObject,
  clearanceFt = DOOR_EGRESS_CLEARANCE_FT
): boolean {
  const zone = doorClearanceZoneRect(door, clearanceFt)
  const overlapX =
    Math.min(boothRect.x + boothRect.width, zone.x + zone.width) -
    Math.max(boothRect.x, zone.x)
  const overlapY =
    Math.min(boothRect.y + boothRect.height, zone.y + zone.height) -
    Math.max(boothRect.y, zone.y)
  if (overlapX > 0 && overlapY > 0) return true
  return edgeClearanceBetweenRects(boothRect, zone) < clearanceFt + 1e-6
}

/** Obstacle rects for auto-arrange — only doors/exits, localized to 5′ zones. */
export function doorClearanceObstacleRects(
  objects: ReadonlyArray<PlacedObject>,
  clearanceFt = DOOR_EGRESS_CLEARANCE_FT
): Rect[] {
  return objects
    .filter(isDoorOrExitObject)
    .map((door) => doorClearanceZoneRect(door, clearanceFt))
}
