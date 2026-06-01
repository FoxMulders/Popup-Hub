/**
 * Destructive geometric merge — boolean union into one `RoomFrame`.
 * Source rooms are spliced out of `doc.rooms`; no `merged_zone` ghost object.
 */

import { forceRecomputeGeometry } from './geometry-sanitize'
import { mergeRoomsToUnion } from './room-union-merge'
import { rebuildSpatialIndexForRoom } from './placement-surface'
import type { FloorPlanDoc, RoomFrame } from './types'

export interface DestructiveMergeSelection {
  roomIds?: ReadonlyArray<string>
  objectIds?: ReadonlyArray<string>
}

export function destructiveMergeInDoc(
  doc: FloorPlanDoc,
  selection: DestructiveMergeSelection
): { doc: FloorPlanDoc; mergedId: string | null; reason?: string } {
  const { doc: next, primaryRoomId, reason } = mergeRoomsToUnion(doc, {
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

/** Legacy: clear `mergedIntoObjectId` binding and remove old `merged_zone` objects. */
export function clearDestructiveMergeInDoc(
  doc: FloorPlanDoc,
  mergedObjectId: string
): FloorPlanDoc {
  const nextFrames = (doc.rooms ?? []).map((f) => {
    if (f.mergedIntoObjectId !== mergedObjectId) return f
    const { mergedIntoObjectId: _drop, perimeterRing: _ring, ...rest } = f
    void _drop
    void _ring
    return rest
  })
  const nextObjects = doc.objects.filter((o) => o.id !== mergedObjectId)
  return { ...doc, rooms: nextFrames, objects: nextObjects }
}

export function framesBoundToMerge(
  frames: ReadonlyArray<RoomFrame>,
  mergedObjectId: string
): RoomFrame[] {
  return frames.filter((f) => f.mergedIntoObjectId === mergedObjectId)
}
