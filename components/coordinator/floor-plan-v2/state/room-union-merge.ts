/**
 * Destructive room merge — boolean polygon union → single `RoomFrame` with multi-sided perimeter when needed.
 */

import {
  sanitizeRoomFrame,
  type SimpleBounds,
} from './geometry-sanitize'
import { unionMergeSelection } from '@/src/utils/layoutMergeEngine'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from './types'

/** Prefer the participant anchored at the union min corner so origin shifts are minimal. */
function pickPrimaryRoomFrame(
  frames: ReadonlyArray<RoomFrame>,
  union: SimpleBounds
): RoomFrame {
  let best = frames[0]!
  let bestScore = Infinity
  for (const f of frames) {
    const score =
      Math.abs(f.originX - union.minX) + Math.abs(f.originY - union.minY)
    if (score < bestScore) {
      bestScore = score
      best = f
    }
  }
  return best
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

  const { union, reason: unionReason } = unionMergeSelection(doc, {
    roomIds: selection.roomIds,
    objectIds: selection.objectIds,
  })
  if (!union) {
    return {
      doc,
      primaryRoomId: frames[0]?.id ?? '',
      reason: unionReason ?? 'Could not compute union perimeter — overlap shapes first',
    }
  }

  if (frames.length === 0) {
    return {
      doc,
      primaryRoomId: '',
      reason: 'Select at least one room to merge fixtures into',
    }
  }

  const primaryRoomId = pickPrimaryRoomFrame(frames, union.aabb).id
  const removedRoomIds = new Set(frames.map((f) => f.id))
  removedRoomIds.delete(primaryRoomId)

  const primaryName =
    frames.map((f) => f.name).filter(Boolean).join(' + ') || 'Merged hall'

  const { minX, minY, maxX, maxY } = union.aabb

  const primaryFrame: RoomFrame = sanitizeRoomFrame({
    id: primaryRoomId,
    name: primaryName,
    originX: minX,
    originY: minY,
    widthFt: Math.max(doc.snapFt || 1, maxX - minX),
    lengthFt: Math.max(doc.snapFt || 1, maxY - minY),
    perimeterRing: union.outerRing,
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
