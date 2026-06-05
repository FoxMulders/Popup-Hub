/**
 * QA merge helpers — Merge (2) uses full 2D axis-aligned bounds for stage
 * fixtures (width × height), not a width-only horizontal line projection.
 *
 * Wire via `destructiveMergeInDocQa` in dashboard QA floor-plan store hooks.
 */

import { forceRecomputeGeometry } from '@/components/coordinator/floor-plan-v2/state/geometry-sanitize'
import { rebuildSpatialIndexForRoom } from '@/components/coordinator/floor-plan-v2/state/placement-surface'
import {
  rotatedAabb,
  type Point,
} from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import {
  clockwiseRectRing,
  roomFrameBounds,
  sanitizeRoomFrame,
  unionBounds,
  type SimpleBounds,
} from '@/components/coordinator/floor-plan-v2/state/geometry-sanitize'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from '@/components/coordinator/floor-plan-v2/state/types'

const MIN_STAGE_DIMENSION_FT = 1

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

/**
 * Precise 2D bounding box for merge participants. Stage objects always
 * contribute width and height — never a degenerate horizontal line at y.
 */
export function mergeParticipantBounds2d(obj: PlacedObject): SimpleBounds {
  const aabb = rotatedAabb(obj)
  let minX = aabb.x
  let minY = aabb.y
  let maxX = aabb.x + aabb.width
  let maxY = aabb.y + aabb.height

  if (obj.kind === 'stage') {
    const width = Math.max(MIN_STAGE_DIMENSION_FT, obj.width)
    const height = Math.max(MIN_STAGE_DIMENSION_FT, obj.height)
    if (!obj.rotation) {
      minX = obj.x
      minY = obj.y
      maxX = obj.x + width
      maxY = obj.y + height
    } else {
      const rotated = rotatedAabb({ ...obj, width, height })
      minX = rotated.x
      minY = rotated.y
      maxX = rotated.x + rotated.width
      maxY = rotated.y + rotated.height
    }
  }

  return { minX, minY, maxX, maxY }
}

/** Union bounds for room frames + placed objects (QA 2D stage footprint). */
export function unionParticipantBoundsQa(
  frames: ReadonlyArray<RoomFrame>,
  objects: ReadonlyArray<PlacedObject>
): SimpleBounds | null {
  const boxes: SimpleBounds[] = []
  for (const f of frames) boxes.push(roomFrameBounds(f))
  for (const o of objects) boxes.push(mergeParticipantBounds2d(o))
  return unionBounds(boxes)
}

export interface UnionMergeSelectionQa {
  roomIds: ReadonlyArray<string>
  objectIds?: ReadonlyArray<string>
}

export interface UnionMergeResultQa {
  doc: FloorPlanDoc
  primaryRoomId: string
  reason?: string
}

/**
 * Merge participants into one rectangular room. Non-primary rooms are removed.
 */
export function mergeRoomsToUnionQa(
  doc: FloorPlanDoc,
  selection: UnionMergeSelectionQa
): UnionMergeResultQa {
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

  const union = unionParticipantBoundsQa(frames, objects)
  if (!union) {
    return {
      doc,
      primaryRoomId: frames[0]?.id ?? '',
      reason: 'Could not compute union perimeter — overlap shapes first',
    }
  }

  if (frames.length === 0) {
    return {
      doc,
      primaryRoomId: '',
      reason: 'Select at least one room to merge fixtures into',
    }
  }

  const primaryRoomId = pickPrimaryRoomFrame(frames, union).id
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

export interface DestructiveMergeSelectionQa {
  roomIds?: ReadonlyArray<string>
  objectIds?: ReadonlyArray<string>
}

export function destructiveMergeInDocQa(
  doc: FloorPlanDoc,
  selection: DestructiveMergeSelectionQa
): { doc: FloorPlanDoc; mergedId: string | null; reason?: string } {
  const { doc: next, primaryRoomId, reason } = mergeRoomsToUnionQa(doc, {
    roomIds: selection.roomIds ?? [],
    objectIds: selection.objectIds,
  })
  if (!primaryRoomId || reason) {
    return { doc, mergedId: null, reason }
  }
  const sanitized = forceRecomputeGeometry(next)
  rebuildSpatialIndexForRoom(sanitized, primaryRoomId)
  return { doc: sanitized, mergedId: primaryRoomId }
}

/** @internal exported for verify scripts */
export type MergeBoundsPoint = Point
