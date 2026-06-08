/**
 * Client-side layout merge — R-tree spatial validation + local boolean union.
 * Never invokes OpenRouter; use only for routine perimeter / fixture merges.
 */

import RBush from 'rbush'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from '@/components/coordinator/floor-plan-v2/state/types'
import { destructiveMergeInDocQa } from '@/src/qa_review/components/coordinator/floor-plan-v2/state/destructive-merge_qa'
import { isJoinableObject } from '@/components/coordinator/floor-plan-v2/state/room-joins'
import { DEFAULT_TOUCH_EPSILON_FT } from '@/components/coordinator/floor-plan-v2/state/room-joins'

export interface LayoutMergeSelection {
  roomIds?: ReadonlyArray<string>
  objectIds?: ReadonlyArray<string>
}

export interface LayoutBBoxEntry {
  minX: number
  minY: number
  maxX: number
  maxY: number
  id: string
  kind: 'room' | 'object'
}

export interface MergeIntersectionReport {
  participantIds: string[]
  overlappingPairs: Array<[string, string]>
  touchingPairs: Array<[string, string]>
  valid: boolean
  reason?: string
}

const TOUCH_EPS = DEFAULT_TOUCH_EPSILON_FT

function frameBounds(frame: RoomFrame): LayoutBBoxEntry {
  return {
    minX: frame.originX,
    minY: frame.originY,
    maxX: frame.originX + frame.widthFt,
    maxY: frame.originY + frame.lengthFt,
    id: frame.id,
    kind: 'room',
  }
}

function objectBounds(obj: PlacedObject): LayoutBBoxEntry {
  return {
    minX: obj.x,
    minY: obj.y,
    maxX: obj.x + obj.width,
    maxY: obj.y + obj.height,
    id: obj.id,
    kind: 'object',
  }
}

/** Build an R-tree index over all room frames and joinable objects. */
export function buildLayoutSpatialIndex(doc: FloorPlanDoc): RBush<LayoutBBoxEntry> {
  const tree = new RBush<LayoutBBoxEntry>()
  const items: LayoutBBoxEntry[] = []
  for (const frame of doc.rooms ?? []) {
    if (frame.mergedIntoObjectId) continue
    items.push(frameBounds(frame))
  }
  for (const obj of doc.objects) {
    if (!isJoinableObject(obj)) continue
    items.push(objectBounds(obj))
  }
  tree.load(items)
  return tree
}

function boxesOverlap(a: LayoutBBoxEntry, b: LayoutBBoxEntry, epsilon = 1e-6): boolean {
  const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
  const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  return overlapX > epsilon && overlapY > epsilon
}

function boxesTouch(a: LayoutBBoxEntry, b: LayoutBBoxEntry, epsilon = TOUCH_EPS): boolean {
  const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX)
  const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY)
  const xContact =
    Math.abs(a.maxX - b.minX) < epsilon || Math.abs(a.minX - b.maxX) < epsilon
  const yContact =
    Math.abs(a.maxY - b.minY) < epsilon || Math.abs(a.minY - b.maxY) < epsilon
  return (xContact && overlapY > epsilon) || (yContact && overlapX > epsilon)
}

function entryForId(doc: FloorPlanDoc, id: string): LayoutBBoxEntry | null {
  const frame = doc.rooms?.find((f) => f.id === id)
  if (frame) return frameBounds(frame)
  const obj = doc.objects.find((o) => o.id === id)
  if (obj) return objectBounds(obj)
  return null
}

/**
 * Validate a merge selection using R-tree intersection queries.
 * Requires at least two participants that overlap or touch.
 */
export function analyzeMergeIntersections(
  doc: FloorPlanDoc,
  selection: LayoutMergeSelection
): MergeIntersectionReport {
  const roomIds = selection.roomIds ?? []
  const objectIds = selection.objectIds ?? []
  const participantIds = [...roomIds, ...objectIds]

  if (participantIds.length < 2) {
    return {
      participantIds,
      overlappingPairs: [],
      touchingPairs: [],
      valid: false,
      reason: 'Select at least two rooms or joinable fixtures to merge.',
    }
  }

  const entries = participantIds
    .map((id) => entryForId(doc, id))
    .filter((e): e is LayoutBBoxEntry => e != null)

  if (entries.length < 2) {
    return {
      participantIds,
      overlappingPairs: [],
      touchingPairs: [],
      valid: false,
      reason: 'Merge participants were not found on the canvas.',
    }
  }

  const tree = buildLayoutSpatialIndex(doc)
  const overlappingPairs: Array<[string, string]> = []
  const touchingPairs: Array<[string, string]> = []
  const seen = new Set<string>()

  for (const entry of entries) {
    const candidates = tree.search({
      minX: entry.minX - TOUCH_EPS,
      minY: entry.minY - TOUCH_EPS,
      maxX: entry.maxX + TOUCH_EPS,
      maxY: entry.maxY + TOUCH_EPS,
    })
    for (const other of candidates) {
      if (other.id === entry.id) continue
      if (!participantIds.includes(other.id)) continue
      const key = [entry.id, other.id].sort().join('::')
      if (seen.has(key)) continue
      seen.add(key)
      if (boxesOverlap(entry, other)) {
        overlappingPairs.push([entry.id, other.id])
      } else if (boxesTouch(entry, other)) {
        touchingPairs.push([entry.id, other.id])
      }
    }
  }

  const connected =
    overlappingPairs.length > 0 ||
    touchingPairs.length > 0 ||
    entries.length >= 2 &&
      entries.every((e) =>
        entries.some(
          (other) =>
            other.id !== e.id &&
            (boxesOverlap(e, other) || boxesTouch(e, other))
        )
      )

  return {
    participantIds,
    overlappingPairs,
    touchingPairs,
    valid: connected,
    reason: connected
      ? undefined
      : 'Merge requires overlapping or touching rooms/fixtures.',
  }
}

/**
 * Run a local destructive merge — no network / AI calls.
 */
export function executeLocalLayoutMerge(
  doc: FloorPlanDoc,
  selection: LayoutMergeSelection
): { doc: FloorPlanDoc; mergedId: string | null; reason?: string } {
  const analysis = analyzeMergeIntersections(doc, selection)
  if (!analysis.valid) {
    return { doc, mergedId: null, reason: analysis.reason }
  }
  return destructiveMergeInDocQa(doc, {
    roomIds: selection.roomIds,
    objectIds: selection.objectIds,
  })
}
