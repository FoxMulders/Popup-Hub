/**
 * Room polygon hit-testing — the only valid placement surface.
 */

import { pointInsideOuterRing } from '@/lib/floor-plan/placement-ring-orientation'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from '../state/types'
import { frameToRing } from '../state/placement-surface'

function roomRings(
  frame: RoomFrame
): ReadonlyArray<ReadonlyArray<readonly [number, number]>> {
  if (frame.perimeterRing && frame.perimeterRing.length >= 3) {
    return [frame.perimeterRing]
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

/** All room frames in the doc — used for placement (ignores merged_zone overlays). */
export function basePlacementRooms(doc: FloorPlanDoc): RoomFrame[] {
  return doc.rooms ?? []
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
