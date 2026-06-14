/**
 * Room polygon hit-testing — the only valid placement surface.
 */

import {
  ensurePlacementOuterRing,
  pointInsideOuterRing,
} from '@/lib/floor-plan/placement-ring-orientation'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from '../state/types'
import { frameToRing } from '../state/placement-surface'
import {
  isCanvasOpenPlacementKind,
  isValidCanvasOpenPlacement,
} from '@/lib/floor-plan/canvas-open-placement'
import {
  footprintWithinBounds,
  isStrictBoundaryPlacementKind,
  resolveRoomPlacementBounds,
} from '@/lib/floor-plan/boundary-constraints'
import {
  isJoinableObject,
  objectFrameOverlapsOrTouches,
} from '../state/room-joins'
import {
  findRoomIdForStructuralPlacement,
  isStructuralWallSnapKind,
} from '../interactions/structural-wall-snap'

export type PlacementProbe = Pick<
  PlacedObject,
  'x' | 'y' | 'width' | 'height' | 'rotation' | 'kind'
>

function joinablePlacementProbe(obj: PlacementProbe): PlacedObject {
  return {
    id: '__placement_probe__',
    kind: obj.kind,
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    rotation: obj.rotation ?? 0,
  } as PlacedObject
}

function roomInteriorAnchor(frame: RoomFrame): { x: number; y: number } {
  return {
    x: frame.originX + frame.widthFt / 2,
    y: frame.originY + frame.lengthFt / 2,
  }
}

function roomRings(
  frame: RoomFrame
): ReadonlyArray<ReadonlyArray<readonly [number, number]>> {
  if (frame.perimeterRing && frame.perimeterRing.length >= 3) {
    return [
      ensurePlacementOuterRing(
        frame.perimeterRing as Array<[number, number]>,
        roomInteriorAnchor(frame)
      ),
    ]
  }
  return [frameToRing(frame)]
}

/** Same winding test as `findRoomIdForPlacementPoint` / placement surfaces. */
function pointInRoomRings(
  p: { x: number; y: number },
  rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>
): boolean {
  for (const ring of rings) {
    if (pointInsideOuterRing(p, ring as Array<[number, number]>)) return true
  }
  return false
}

export function activeDropZoneRooms(doc: FloorPlanDoc): RoomFrame[] {
  return (doc.rooms ?? []).filter((r) => !r.mergedIntoObjectId)
}

/**
 * True only when `(x, y)` lies inside an active room polygon.
 * Background / unusable canvas area always returns false.
 */
export function isPointInRoom(
  doc: FloorPlanDoc,
  x: number,
  y: number,
  roomId?: string
): boolean {
  const p = { x, y }
  const rooms = activeDropZoneRooms(doc)
  if (rooms.length === 0) return false

  if (roomId) {
    const frame = rooms.find((r) => r.id === roomId)
    if (!frame) return false
    return pointInRoomRings(p, roomRings(frame))
  }

  for (const frame of rooms) {
    if (pointInRoomRings(p, roomRings(frame))) return true
  }
  return false
}

export function isPointInRoomForObject(
  doc: FloorPlanDoc,
  obj: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  roomId?: string
): boolean {
  const cx = obj.x + obj.width / 2
  const cy = obj.y + obj.height / 2
  return isPointInRoom(doc, cx, cy, roomId)
}

/** Active room frames used for placement (ignores dissolved ghosts and merged_zone). */
export function basePlacementRooms(doc: FloorPlanDoc): RoomFrame[] {
  return activeDropZoneRooms(doc)
}

/** Topmost base room whose polygon contains `p` (no merged_zone). */
export function findRoomIdForPlacementPoint(
  doc: FloorPlanDoc,
  p: { x: number; y: number }
): string | null {
  const rooms = basePlacementRooms(doc)
  for (let i = rooms.length - 1; i >= 0; i--) {
    const frame = rooms[i]!
    if (pointInRoomRings(p, roomRings(frame))) return frame.id
  }
  return null
}

/** True when `p` lies inside any base room polygon. */
export function isValidPlacementPoint(
  doc: FloorPlanDoc,
  p: { x: number; y: number }
): boolean {
  for (const frame of basePlacementRooms(doc)) {
    if (pointInRoomRings(p, roomRings(frame))) return true
  }
  return false
}

/**
 * Resolve which room should own a placement at `p`. Ray-cast hit wins;
 * otherwise fall back to `preferredRoomId` when the point lies inside
 * that frame (covers active-room draws before sync catches up).
 */
export function resolvePlacementRoomId(
  doc: FloorPlanDoc,
  p: { x: number; y: number },
  preferredRoomId?: string | null
): string | null {
  const hit = findRoomIdForPlacementPoint(doc, p)
  if (hit) return hit
  if (preferredRoomId && isPointInRoom(doc, p.x, p.y, preferredRoomId)) {
    return preferredRoomId
  }
  return null
}

/** Joinable fixtures (stage) may attach flush outside a room perimeter. */
export function findRoomIdForJoinableObjectPlacement(
  doc: FloorPlanDoc,
  obj: PlacementProbe
): string | null {
  if (!isJoinableObject(joinablePlacementProbe(obj))) return null
  const probe = joinablePlacementProbe(obj)
  const rooms = activeDropZoneRooms(doc)
  for (let i = rooms.length - 1; i >= 0; i--) {
    const frame = rooms[i]!
    if (objectFrameOverlapsOrTouches(probe, frame)) return frame.id
  }
  return null
}

/**
 * Resolve owning room for a drawn/moved object. Interior centroid wins;
 * joinable kinds may attach via perimeter touch when the center sits outside.
 */
export function resolvePlacementRoomIdForObject(
  doc: FloorPlanDoc,
  obj: PlacementProbe,
  preferredRoomId?: string | null
): string | null {
  const center = {
    x: obj.x + obj.width / 2,
    y: obj.y + obj.height / 2,
  }
  const hit = findRoomIdForPlacementPoint(doc, center)
  if (hit) return hit

  if (isStructuralWallSnapKind(obj.kind)) {
    return findRoomIdForStructuralPlacement(doc, center, preferredRoomId)
  }

  if (isCanvasOpenPlacementKind(obj.kind)) return null

  const joinHit = findRoomIdForJoinableObjectPlacement(doc, obj)
  if (joinHit) return joinHit

  if (preferredRoomId && isPointInRoom(doc, center.x, center.y, preferredRoomId)) {
    return preferredRoomId
  }
  return null
}

/** True when an object may be placed (inside room, stage touching a room, or canvas-open kinds). */
export function isValidObjectPlacement(
  doc: FloorPlanDoc,
  obj: PlacementProbe,
  roomId?: string | null
): boolean {
  if (isCanvasOpenPlacementKind(obj.kind)) {
    return isValidCanvasOpenPlacement(doc, obj)
  }

  if (isStructuralWallSnapKind(obj.kind)) {
    const resolved =
      roomId ?? resolvePlacementRoomIdForObject(doc, obj, null)
    return resolved != null
  }

  const resolved =
    roomId ?? resolvePlacementRoomIdForObject(doc, obj, null)
  if (!resolved) return false

  if (isStrictBoundaryPlacementKind(obj.kind)) {
    const bounds = resolveRoomPlacementBounds(doc, resolved)
    if (!bounds) return false
    if (!footprintWithinBounds(joinablePlacementProbe(obj), bounds)) return false
  }

  if (isPointInRoomForObject(doc, obj, resolved)) return true

  if (!isJoinableObject(joinablePlacementProbe(obj))) return false
  const frame = activeDropZoneRooms(doc).find((r) => r.id === resolved)
  if (!frame) return false
  return objectFrameOverlapsOrTouches(joinablePlacementProbe(obj), frame)
}

/**
 * Resolve which room owns an object — sidecar tag first, then geometry
 * (same fallback `legacyRoomsFromDoc` uses when persisting).
 */
export function resolveObjectRoomId(
  doc: FloorPlanDoc,
  obj: PlacedObject,
  preferredRoomId?: string | null
): string | null {
  const tagged = doc.objectRoom?.[obj.id]
  if (tagged) return tagged
  return resolvePlacementRoomIdForObject(doc, obj, preferredRoomId ?? null)
}

export function isObjectInRoom(
  doc: FloorPlanDoc,
  obj: PlacedObject,
  roomId: string,
  preferredRoomId?: string | null
): boolean {
  return resolveObjectRoomId(doc, obj, preferredRoomId) === roomId
}
