/**
 * Overlap exemptions for intentional merge geometry (room + stage, etc.).
 * Merge-eligible overlaps are not placement violations.
 */

import type { PlacedObject, RoomFrame } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  isJoinableObject,
  objectFrameOverlapsOrTouches,
  joinableObjectsOverlapOrTouch,
} from '@/components/coordinator/floor-plan-v2/state/room-joins'
import { isMergeUnionEligible } from '@/components/coordinator/floor-plan-v2/state/merge-selection-union'

export interface MergeOverlapContext {
  rooms?: ReadonlyArray<RoomFrame>
}

/** Joinable fixture (stage) overlapping/touching a room frame — valid pre-merge. */
export function isMergeOverlapExemptObjectAndRoom(
  obj: PlacedObject,
  frame: RoomFrame
): boolean {
  if (!isJoinableObject(obj)) return false
  if (frame.mergedIntoObjectId) return false
  return objectFrameOverlapsOrTouches(obj, frame)
}

/** Two merge-union fixtures overlapping while aligning for Merge. */
export function isMergeOverlapExemptObjectPair(
  a: PlacedObject,
  b: PlacedObject
): boolean {
  if (a.id === b.id) return false
  if (shouldSkipNonMergeKinds(a, b)) return false
  if (!isMergeUnionEligible(a) || !isMergeUnionEligible(b)) {
    if (isJoinableObject(a) && isJoinableObject(b)) {
      return joinableObjectsOverlapOrTouch(a, b)
    }
    return false
  }
  return footprintsOverlapForExempt(a, b)
}

function shouldSkipNonMergeKinds(a: PlacedObject, b: PlacedObject): boolean {
  if (a.kind === 'booth' || b.kind === 'booth') return true
  if (a.kind === 'merged_zone' || b.kind === 'merged_zone') return true
  return false
}

function footprintsOverlapForExempt(a: PlacedObject, b: PlacedObject): boolean {
  if (isJoinableObject(a) && isJoinableObject(b)) {
    return joinableObjectsOverlapOrTouch(a, b)
  }
  const ax1 = a.x + a.width
  const ay1 = a.y + a.height
  const bx1 = b.x + b.width
  const by1 = b.y + b.height
  const overlapX = Math.min(ax1, bx1) - Math.max(a.x, b.x)
  const overlapY = Math.min(ay1, by1) - Math.max(a.y, b.y)
  return overlapX > 1e-6 && overlapY > 1e-6
}

export function isMergeOverlapExempt(
  a: PlacedObject,
  b: PlacedObject,
  ctx?: MergeOverlapContext
): boolean {
  if (isMergeOverlapExemptObjectPair(a, b)) return true
  const rooms = ctx?.rooms ?? []
  if (isJoinableObject(a)) {
    for (const frame of rooms) {
      if (isMergeOverlapExemptObjectAndRoom(a, frame)) return true
    }
  }
  if (isJoinableObject(b)) {
    for (const frame of rooms) {
      if (isMergeOverlapExemptObjectAndRoom(b, frame)) return true
    }
  }
  return false
}

/** Moved object vs room frame — exempt when merge-eligible overlap. */
export function isMergeOverlapExemptObjectAndRoomPair(
  obj: PlacedObject,
  frame: RoomFrame
): boolean {
  return isMergeOverlapExemptObjectAndRoom(obj, frame)
}
