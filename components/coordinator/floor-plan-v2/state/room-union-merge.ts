/**
 * Destructive room merge — axis-aligned bounding union → single `RoomFrame` (4 vertices).
 */

import {
  clockwiseRectRing,
  sanitizeRoomFrame,
  unionParticipantBounds,
} from './geometry-sanitize'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from './types'

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
 * Merge participants into one rectangular room. Non-primary rooms are removed.
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

  const union = unionParticipantBounds(frames, objects)
  if (!union) {
    return {
      doc,
      primaryRoomId: frames[0]?.id ?? '',
      reason: 'Could not compute union perimeter — overlap shapes first',
    }
  }

  const primaryRoomId = frames[0]!.id
  const removedRoomIds = new Set(frames.map((f) => f.id))
  removedRoomIds.delete(primaryRoomId)

  const primaryName =
    frames.map((f) => f.name).filter(Boolean).join(' + ') || 'Merged hall'

  const perimeterRing = clockwiseRectRing(
    union.minX,
    union.minY,
    union.maxX,
    union.maxY
  )

  const primaryFrame: RoomFrame = sanitizeRoomFrame({
    id: primaryRoomId,
    name: primaryName,
    originX: union.minX,
    originY: union.minY,
    widthFt: Math.max(doc.snapFt || 1, union.maxX - union.minX),
    lengthFt: Math.max(doc.snapFt || 1, union.maxY - union.minY),
    perimeterRing,
  })

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
