/**
 * Destructive room merge — polygon-clipping union → single `RoomFrame`.
 * Source rooms are removed from `doc.rooms`; no ghost frames or parallel guides.
 */

import {
  closeRing,
  ensureOuterRingCCW,
  guardedPolygonUnion,
  simplifyRingCollinear,
} from '@/lib/floor-plan/polygon-clipping-union'
import type { Polygon, Ring } from 'polygon-clipping'
import { frameToRing } from './placement-surface'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from './types'
import { rotatedAabb } from '../interactions/geometry'

function rectPolygon(frame: RoomFrame): Polygon {
  const ring = closeRing(
    frameToRing(frame).map(([x, y]) => [x, y] as [number, number])
  )
  return [ensureOuterRingCCW(ring)]
}

function objectPolygon(obj: PlacedObject): Polygon | null {
  const aabb = rotatedAabb(obj)
  const ring: Ring = [
    [aabb.x, aabb.y],
    [aabb.x + aabb.width, aabb.y],
    [aabb.x + aabb.width, aabb.y + aabb.height],
    [aabb.x, aabb.y + aabb.height],
    [aabb.x, aabb.y],
  ]
  return [ensureOuterRingCCW(ring)]
}

export interface UnionMergeSelection {
  roomIds: ReadonlyArray<string>
  objectIds?: ReadonlyArray<string>
}

export interface UnionMergeResult {
  doc: FloorPlanDoc
  primaryRoomId: string
  reason?: string
}

/**
 * Merge participants into one room with `perimeterRing` (CCW outer, clipper-safe).
 * Splices non-primary rooms out of `doc.rooms` entirely.
 */
export function mergeRoomsToUnion(
  doc: FloorPlanDoc,
  selection: UnionMergeSelection
): UnionMergeResult {
  const roomIdSet = new Set(selection.roomIds)
  const objectIdSet = new Set(selection.objectIds ?? [])
  const frames = (doc.rooms ?? []).filter((f) => roomIdSet.has(f.id))
  const objects = doc.objects.filter((o) => objectIdSet.has(o.id))

  if (frames.length + objects.length < 2) {
    return {
      doc,
      primaryRoomId: frames[0]?.id ?? '',
      reason: 'Select two or more overlapping rooms or fixtures to merge',
    }
  }

  const polygons: Polygon[] = []
  for (const f of frames) polygons.push(rectPolygon(f))
  for (const o of objects) {
    const poly = objectPolygon(o)
    if (poly) polygons.push(poly)
  }

  const mp = guardedPolygonUnion(polygons)
  const poly = mp[0]
  const outer = poly?.[0]
  if (!outer || outer.length < 4) {
    return {
      doc,
      primaryRoomId: frames[0]?.id ?? '',
      reason: 'Could not compute union perimeter — overlap shapes first',
    }
  }

  const perimeterRing = simplifyRingCollinear(ensureOuterRingCCW(outer))
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const [x, y] of perimeterRing) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  const primaryRoomId = frames[0]!.id
  const removedRoomIds = new Set(frames.map((f) => f.id))
  removedRoomIds.delete(primaryRoomId)

  const primaryName =
    frames.map((f) => f.name).filter(Boolean).join(' + ') || 'Merged hall'

  const primaryFrame: RoomFrame = {
    id: primaryRoomId,
    name: primaryName,
    originX: minX,
    originY: minY,
    widthFt: Math.max(doc.snapFt || 1, maxX - minX),
    lengthFt: Math.max(doc.snapFt || 1, maxY - minY),
    perimeterRing,
  }

  const removeObjectIds = new Set(objects.map((o) => o.id))
  const nextObjects = doc.objects.filter((o) => !removeObjectIds.has(o.id))

  const objectRoom = { ...(doc.objectRoom ?? {}) }
  for (const id of removeObjectIds) {
    delete objectRoom[id]
  }
  for (const [objId, roomId] of Object.entries(objectRoom)) {
    if (removedRoomIds.has(roomId)) {
      objectRoom[objId] = primaryRoomId
    }
  }

  const nextFrames = (doc.rooms ?? [])
    .filter((f) => !removedRoomIds.has(f.id))
    .map((f) => (f.id === primaryRoomId ? primaryFrame : f))

  return {
    doc: {
      ...doc,
      rooms: nextFrames,
      objects: nextObjects,
      objectRoom,
    },
    primaryRoomId,
  }
}
