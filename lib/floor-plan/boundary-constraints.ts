/**
 * Strict room perimeter bounds for booth/table placement and auto-arrange clipping.
 */

import { rotatedAabb, canvasClampDelta, type Rect } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import { objectFootprintAabb } from '@/components/coordinator/floor-plan-v2/state/table-cluster-layout'
import type { BoothObject, FloorPlanDoc, PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'
import { resolveRoomPlacementSurface } from '@/components/coordinator/floor-plan-v2/state/placement-surface'
import { BOOTH_SAFETY_BUFFER_FT } from '@/lib/booth-planner/layout-clearance-constants'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'

/** Minimum inset from room walls for patron tables (ft). */
export const ROOM_PLACEMENT_CLEARANCE_FT = BOOTH_SAFETY_BUFFER_FT * 2

/**
 * Vendor booth drag/placement inset from the room frame edge (ft).
 * 0 = flush to west (min X) and east (max X) room bounds — no 4′ patron buffer.
 */
export const VENDOR_WALL_INSET_FT = 0

/** Wall inset used for drag clamp + boundary validation. */
export function wallInsetClearanceFt(obj: PlacedObject): number {
  if (obj.kind === 'booth' && !isGuestTableBooth(obj as BoothObject)) {
    return VENDOR_WALL_INSET_FT
  }
  return ROOM_PLACEMENT_CLEARANCE_FT
}

export interface RoomPlacementBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export function resolveRoomPlacementBounds(
  doc: FloorPlanDoc,
  roomId: string
): RoomPlacementBounds | null {
  const surface = resolveRoomPlacementSurface(doc, roomId)
  if (surface) {
    return {
      minX: surface.minX,
      minY: surface.minY,
      maxX: surface.maxX,
      maxY: surface.maxY,
    }
  }
  const frame = (doc.rooms ?? []).find((r) => r.id === roomId)
  if (!frame) return null
  return {
    minX: frame.originX,
    minY: frame.originY,
    maxX: frame.originX + frame.widthFt,
    maxY: frame.originY + frame.lengthFt,
  }
}

/** Inset rectangle leaving `clearanceFt` safety margin on every side. */
export function insetBounds(
  bounds: RoomPlacementBounds,
  clearanceFt: number
): Rect {
  return {
    x: bounds.minX + clearanceFt,
    y: bounds.minY + clearanceFt,
    width: Math.max(0, bounds.maxX - bounds.minX - clearanceFt * 2),
    height: Math.max(0, bounds.maxY - bounds.minY - clearanceFt * 2),
  }
}

/**
 * True when the object's rotated footprint sits fully inside `bounds`
 * with optional clearance inset.
 */
export function footprintWithinBounds(
  obj: PlacedObject,
  bounds: RoomPlacementBounds,
  clearanceFt?: number
): boolean {
  const inset =
    clearanceFt ??
    wallInsetClearanceFt(obj)
  const inner = insetBounds(bounds, inset)
  if (inner.width <= 0 || inner.height <= 0) return false
  const aabb = objectFootprintAabb(obj as PlacedObject)
  const eps = 1e-6
  return (
    aabb.x >= inner.x - eps &&
    aabb.y >= inner.y - eps &&
    aabb.x + aabb.width <= inner.x + inner.width + eps &&
    aabb.y + aabb.height <= inner.y + inner.height + eps
  )
}

/** Booth/table kinds that must stay strictly inside the room perimeter. */
export function isStrictBoundaryPlacementKind(kind: PlacedObject['kind']): boolean {
  return kind === 'booth'
}

/**
 * Compute translation that pulls `obj`'s rotated AABB inside `inner` rect.
 * Returns `{ dx: 0, dy: 0 }` when already contained.
 */
export function clampDeltaToRect(
  obj: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  inner: Rect
): { dx: number; dy: number } {
  const aabb = rotatedAabb(obj as PlacedObject)
  let dx = 0
  let dy = 0
  if (aabb.width <= inner.width) {
    if (aabb.x < inner.x) dx = inner.x - aabb.x
    else if (aabb.x + aabb.width > inner.x + inner.width) {
      dx = inner.x + inner.width - (aabb.x + aabb.width)
    }
  } else {
    dx = inner.x - aabb.x
  }
  if (aabb.height <= inner.height) {
    if (aabb.y < inner.y) dy = inner.y - aabb.y
    else if (aabb.y + aabb.height > inner.y + inner.height) {
      dy = inner.y + inner.height - (aabb.y + aabb.height)
    }
  } else {
    dy = inner.y - aabb.y
  }
  return { dx, dy }
}

/**
 * Clip booth coordinates so the rotated footprint stays inside room bounds.
 * Used after AI auto-arrange when the model returns out-of-bounds slots.
 */
export function clipBoothToRoomBounds(
  booth: BoothObject,
  bounds: RoomPlacementBounds,
  clearanceFt = ROOM_PLACEMENT_CLEARANCE_FT
): BoothObject {
  const inner = insetBounds(bounds, clearanceFt)
  if (inner.width <= 0 || inner.height <= 0) return booth
  const { dx, dy } = clampDeltaToRect(booth, inner)
  if (dx === 0 && dy === 0) return booth
  return { ...booth, x: booth.x + dx, y: booth.y + dy }
}

/** Clip booth in room-local coordinates `[0, roomW] × [0, roomH]`. */
export function clipBoothToLocalRoom(
  booth: BoothObject,
  roomW: number,
  roomH: number,
  clearanceFt?: number
): BoothObject {
  return clipBoothToRoomBounds(
    booth,
    { minX: 0, minY: 0, maxX: roomW, maxY: roomH },
    clearanceFt ?? wallInsetClearanceFt(booth)
  )
}

/** Room-scoped drag clamp — footprint AABB vs room edges (independent X/Y). */
export function footprintClampDeltaForRoom(
  obj: PlacedObject,
  doc: FloorPlanDoc,
  roomId: string | null | undefined
): { dx: number; dy: number } {
  if (!roomId || !isStrictBoundaryPlacementKind(obj.kind)) {
    return canvasClampDelta(obj, doc.canvasWidthFt, doc.canvasLengthFt)
  }
  const bounds = resolveRoomPlacementBounds(doc, roomId)
  if (!bounds) {
    return canvasClampDelta(obj, doc.canvasWidthFt, doc.canvasLengthFt)
  }

  const clearance = wallInsetClearanceFt(obj)
  const footprint = objectFootprintAabb(obj)
  const roomW = bounds.maxX - bounds.minX
  const roomH = bounds.maxY - bounds.minY
  const innerW = Math.max(0, roomW - clearance * 2)
  const innerH = Math.max(0, roomH - clearance * 2)
  const minX = bounds.minX + clearance
  const minY = bounds.minY + clearance
  const maxX = bounds.maxX - clearance - footprint.width
  const maxY = bounds.maxY - clearance - footprint.height

  let dx = 0
  let dy = 0

  if (footprint.width > innerW) {
    dx = minX - footprint.x
  } else {
    if (footprint.x < minX) dx = minX - footprint.x
    else if (footprint.x > maxX) dx = maxX - footprint.x
  }

  if (footprint.height > innerH) {
    dy = minY - footprint.y
  } else {
    if (footprint.y < minY) dy = minY - footprint.y
    else if (footprint.y > maxY) dy = maxY - footprint.y
  }

  return { dx, dy }
}

/** @deprecated Alias — use {@link footprintClampDeltaForRoom}. */
export function boothClampDeltaForRoom(
  obj: PlacedObject,
  doc: FloorPlanDoc,
  roomId: string | null | undefined
): { dx: number; dy: number } {
  return footprintClampDeltaForRoom(obj, doc, roomId)
}
