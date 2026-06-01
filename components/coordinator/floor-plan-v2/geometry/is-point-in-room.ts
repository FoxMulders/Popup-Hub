/**
 * Room polygon hit-testing — the only valid placement surface.
 */

import type { FloorPlanDoc, PlacedObject, RoomFrame } from '../state/types'
import { pointInAnyRing } from './point-in-polygon'
import { frameToRing } from '../state/placement-surface'

function roomRings(
  frame: RoomFrame
): ReadonlyArray<ReadonlyArray<readonly [number, number]>> {
  if (frame.perimeterRing && frame.perimeterRing.length >= 3) {
    return [frame.perimeterRing]
  }
  return [frameToRing(frame)]
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
    return pointInAnyRing(p, roomRings(frame))
  }

  for (const frame of rooms) {
    if (pointInAnyRing(p, roomRings(frame))) return true
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
