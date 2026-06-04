/**
 * Canvas object groups — Tinkercad-style Join / Unjoin (transform groups).
 *
 * This is intentionally separate from `joinGroupId` on rooms/objects in
 * `room-joins.ts`, which only dissolves perimeter walls for auxiliary
 * rooms and stages. `canvasGroupId` means: "these objects move, rotate,
 * and copy together as one selection."
 *
 * Non-destructive model
 * ---------------------
 * - Children stay in `FloorPlanDoc.objects` with their world-space
 *   `x`, `y`, `width`, `height`, and `rotation` unchanged at join time.
 * - The group is metadata in `doc.objectGroups` plus a `canvasGroupId`
 *   tag on each member.
 * - Unjoin only removes tags and the group record — no coordinate
 *   rewrite — so undo/redo via full-doc snapshots restores perfectly.
 *
 * When the user drags the group later, apply the same `(dx, dy)` (and
 * optional `dRotation` about the group center) to every member in one
 * `updateObjects` call so one history step still captures the gesture.
 */

import { rotatedAabb, objectCenter, type Point, type Rect } from '../interactions/geometry'
import type {
  CanvasObjectGroup,
  FloorPlanDoc,
  GroupBounds,
  ObjectKind,
  PlacedObject,
} from './types'

/** Distinct from perimeter `joinGroupId` — transform/assemble grouping only. */
export const CANVAS_GROUP_FIELD = 'canvasGroupId' as const

export type CanvasGroupId = string

/** Kinds that may be assembled into a transform group (product rule). */
export const GROUPABLE_OBJECT_KINDS: ReadonlySet<ObjectKind> = new Set<ObjectKind>([
  'booth',
  'wall',
  'open_wall',
  'label',
  'door',
  'emergency_exit',
  'stage',
  'food_truck',
])

export function isGroupableObject(obj: PlacedObject): boolean {
  return GROUPABLE_OBJECT_KINDS.has(obj.kind)
}

export interface JoinObjectsResult {
  doc: FloorPlanDoc
  groupId: CanvasGroupId | null
  /** Why join was rejected — for toolbar toasts. */
  reason?: 'too_few' | 'not_groupable' | 'already_grouped' | 'mixed_groups'
}

export interface UnjoinObjectsResult {
  doc: FloorPlanDoc
  /** Group removed, if any. */
  groupId: CanvasGroupId | null
}

function newGroupId(): CanvasGroupId {
  return `grp_${crypto.randomUUID()}`
}

function objectById(doc: FloorPlanDoc): Map<string, PlacedObject> {
  return new Map(doc.objects.map((o) => [o.id, o]))
}

/**
 * Union AABB of rotated footprints for a set of objects.
 */
export function unionBoundsForObjects(
  objects: ReadonlyArray<PlacedObject>
): GroupBounds | null {
  if (objects.length === 0) return null

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const obj of objects) {
    const box = rotatedAabb(obj)
    minX = Math.min(minX, box.x)
    minY = Math.min(minY, box.y)
    maxX = Math.max(maxX, box.x + box.width)
    maxY = Math.max(maxY, box.y + box.height)
  }

  const width = maxX - minX
  const height = maxY - minY
  return {
    x: minX,
    y: minY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  }
}

/**
 * Geometric centroid: average of each member's object center (rotation-aware).
 * Useful for labels; prefer `bounds.centerX/Y` for transform pivots.
 */
export function memberCentroid(objects: ReadonlyArray<PlacedObject>): Point {
  if (objects.length === 0) return { x: 0, y: 0 }
  let sx = 0
  let sy = 0
  for (const obj of objects) {
    const c = objectCenter(obj)
    sx += c.x
    sy += c.y
  }
  return { x: sx / objects.length, y: sy / objects.length }
}

export function recomputeGroupBounds(
  doc: FloorPlanDoc,
  groupId: CanvasGroupId
): GroupBounds | null {
  const group = doc.objectGroups?.[groupId]
  if (!group) return null
  const byId = objectById(doc)
  const members = group.memberIds
    .map((id) => byId.get(id))
    .filter((o): o is PlacedObject => o != null)
  return unionBoundsForObjects(members)
}

/** Expand selection to full group when any member is selected. */
export function selectionWithGroupMembers(
  doc: FloorPlanDoc,
  selectedIds: ReadonlySet<string>
): Set<string> {
  const out = new Set(selectedIds)
  const groups = doc.objectGroups ?? {}
  for (const id of selectedIds) {
    const obj = doc.objects.find((o) => o.id === id)
    const gid = obj?.canvasGroupId
    if (!gid || !groups[gid]) continue
    for (const mid of groups[gid].memberIds) out.add(mid)
  }
  return out
}

function setCanvasGroupId(
  obj: PlacedObject,
  groupId: CanvasGroupId | undefined
): PlacedObject {
  if (groupId == null) {
    const { canvasGroupId: _drop, ...rest } = obj
    return rest as PlacedObject
  }
  return { ...obj, canvasGroupId: groupId }
}

/**
 * Join: tag members with `canvasGroupId` and append a group sidecar entry.
 * Does not rewrite child coordinates.
 */
export function joinObjectsInDoc(
  doc: FloorPlanDoc,
  objectIds: ReadonlyArray<string>
): JoinObjectsResult {
  const uniqueIds = [...new Set(objectIds)]
  if (uniqueIds.length < 2) {
    return { doc, groupId: null, reason: 'too_few' }
  }

  const byId = objectById(doc)
  const members: PlacedObject[] = []
  let existingGroup: CanvasGroupId | undefined

  for (const id of uniqueIds) {
    const obj = byId.get(id)
    if (!obj) continue
    if (!isGroupableObject(obj)) {
      return { doc, groupId: null, reason: 'not_groupable' }
    }
    if (obj.canvasGroupId) {
      if (!existingGroup) existingGroup = obj.canvasGroupId
      else if (obj.canvasGroupId !== existingGroup) {
        return { doc, groupId: null, reason: 'mixed_groups' }
      }
    }
    members.push(obj)
  }

  if (members.length < 2) {
    return { doc, groupId: null, reason: 'too_few' }
  }

  const bounds = unionBoundsForObjects(members)
  if (!bounds) {
    return { doc, groupId: null, reason: 'too_few' }
  }

  const groupId = existingGroup ?? newGroupId()
  const memberIdSet = new Set([
    ...(doc.objectGroups?.[groupId]?.memberIds ?? []),
    ...members.map((m) => m.id),
  ])

  const nextObjects = doc.objects.map((o) => {
    if (!memberIdSet.has(o.id)) return o
    return setCanvasGroupId(o, groupId)
  })

  const nextGroup: CanvasObjectGroup = {
    id: groupId,
    memberIds: [...memberIdSet],
    bounds,
    createdAt: doc.objectGroups?.[groupId]?.createdAt ?? new Date().toISOString(),
  }

  const nextDoc: FloorPlanDoc = {
    ...doc,
    objects: nextObjects,
    objectGroups: {
      ...(doc.objectGroups ?? {}),
      [groupId]: nextGroup,
    },
  }

  return { doc: nextDoc, groupId }
}

/**
 * Unjoin: strip `canvasGroupId` from all members and delete the group record.
 * Child geometry is untouched — perfect restore when undo pops the prior snapshot.
 */
export function unjoinGroupInDoc(
  doc: FloorPlanDoc,
  groupId: CanvasGroupId
): UnjoinObjectsResult {
  const group = doc.objectGroups?.[groupId]
  if (!group) {
    return { doc, groupId: null }
  }

  const memberSet = new Set(group.memberIds)
  const nextObjects = doc.objects.map((o) =>
    memberSet.has(o.id) ? setCanvasGroupId(o, undefined) : o
  )

  const { [groupId]: _removed, ...restGroups } = doc.objectGroups ?? {}
  const nextDoc: FloorPlanDoc = {
    ...doc,
    objects: nextObjects,
    objectGroups: Object.keys(restGroups).length > 0 ? restGroups : undefined,
  }

  return { doc: nextDoc, groupId }
}

/**
 * Resolve a group id from the current selection (all members must share one group).
 */
export function groupIdFromSelection(
  doc: FloorPlanDoc,
  selectedIds: ReadonlySet<string>
): CanvasGroupId | null {
  let gid: CanvasGroupId | null = null
  for (const id of selectedIds) {
    const obj = doc.objects.find((o) => o.id === id)
    if (!obj?.canvasGroupId) return null
    if (!gid) gid = obj.canvasGroupId
    else if (gid !== obj.canvasGroupId) return null
  }
  return gid
}

/**
 * Apply a translation to every member of a group (for drag-as-unit).
 * Call with `pushHistory: false` during gesture, once on commit.
 */
export function translateGroupMembers(
  doc: FloorPlanDoc,
  groupId: CanvasGroupId,
  dx: number,
  dy: number
): FloorPlanDoc {
  const group = doc.objectGroups?.[groupId]
  if (!group || (dx === 0 && dy === 0)) return doc

  const memberSet = new Set(group.memberIds)
  const nextObjects = doc.objects.map((o) => {
    if (!memberSet.has(o.id)) return o
    return { ...o, x: o.x + dx, y: o.y + dy }
  })

  const bounds = recomputeGroupBounds({ ...doc, objects: nextObjects }, groupId)
  return {
    ...doc,
    objects: nextObjects,
    objectGroups: bounds
      ? {
          ...(doc.objectGroups ?? {}),
          [groupId]: { ...group, bounds },
        }
      : doc.objectGroups,
  }
}
