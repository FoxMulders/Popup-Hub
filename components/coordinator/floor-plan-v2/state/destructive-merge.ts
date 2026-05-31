/**
 * Destructive geometric merge — replaces participant rooms/fixtures with
 * one `merged_zone` SVG path (boolean union). Original object paths are
 * removed; room frames stay in the doc for save-bridge but are hidden.
 */

import {
  ensurePlacementOuterRing,
  interiorAnchorFromBounds,
} from '@/lib/floor-plan/placement-ring-orientation'
import { ringsToLocalSpace } from '@/lib/floor-plan/shape-union'
import { rebuildSpatialIndexForRoom } from './placement-surface'
import { buildJoinedZone } from './room-joins'
import type { FloorPlanDoc, MergedZoneObject, PlacedObject, RoomFrame } from './types'

export interface DestructiveMergeSelection {
  roomIds?: ReadonlyArray<string>
  objectIds?: ReadonlyArray<string>
}

export function destructiveMergeInDoc(
  doc: FloorPlanDoc,
  selection: DestructiveMergeSelection
): { doc: FloorPlanDoc; mergedId: string | null; reason?: string } {
  const roomIdSet = new Set(selection.roomIds ?? [])
  const objectIdSet = new Set(selection.objectIds ?? [])
  const frames = (doc.rooms ?? []).filter((f) => roomIdSet.has(f.id))
  const objects = doc.objects.filter((o) => objectIdSet.has(o.id))

  const total = frames.length + objects.length
  if (total < 2) {
    return {
      doc,
      mergedId: null,
      reason: 'Select overlapping rooms and/or stages, then Merge',
    }
  }

  const zone = buildJoinedZone('merge-preview', frames, objects)
  if (!zone || zone.rings.length === 0) {
    return {
      doc,
      mergedId: null,
      reason: 'Could not compute union perimeter — overlap shapes first',
    }
  }

  const { minX, minY, maxX, maxY } = zone.aabb
  const width = Math.max(doc.snapFt || 1, maxX - minX)
  const height = Math.max(doc.snapFt || 1, maxY - minY)
  const anchor = interiorAnchorFromBounds([
    ...frames.map((f) => ({
      x: f.originX + f.widthFt / 2,
      y: f.originY + f.lengthFt / 2,
    })),
    ...objects.map((o) => ({
      x: o.x + o.width / 2,
      y: o.y + o.height / 2,
    })),
  ])
  const outwardRings = zone.rings.map((ring) =>
    ensurePlacementOuterRing(ring, anchor)
  )
  const localRings = ringsToLocalSpace(outwardRings, minX, minY)

  const primary =
    objects[0] ??
    (frames[0]
      ? ({
          id: frames[0].id,
          kind: 'stage' as const,
          x: frames[0].originX,
          y: frames[0].originY,
          width: frames[0].widthFt,
          height: frames[0].lengthFt,
          rotation: 0,
          label: frames[0].name,
        } satisfies PlacedObject)
      : null)
  if (!primary) {
    return { doc, mergedId: null, reason: 'No merge participants' }
  }

  const mergedId = `obj-${crypto.randomUUID()}`
  const merged: MergedZoneObject = {
    id: mergedId,
    kind: 'merged_zone',
    x: minX,
    y: minY,
    width,
    height,
    rotation: 0,
    label: primary.label ?? (frames[0]?.name ?? 'Merged zone'),
    rings: localRings,
    fill: '#0f766e',
    stroke: '#0f766e',
    fillOpacity: 0.2,
    mergedFromIds: [...frames.map((f) => f.id), ...objects.map((o) => o.id)],
    sourceRoomIds: frames.map((f) => f.id),
  }

  const removeObjectIds = new Set(objects.map((o) => o.id))
  const nextObjects = [
    ...doc.objects.filter((o) => !removeObjectIds.has(o.id)),
    merged,
  ]

  const objectRoom = { ...(doc.objectRoom ?? {}) }
  for (const id of removeObjectIds) {
    delete objectRoom[id]
  }
  const ownerRoom = frames[0]?.id ?? doc.objectRoom?.[objects[0]?.id ?? '']
  if (ownerRoom) objectRoom[mergedId] = ownerRoom

  const nextFrames: RoomFrame[] = (doc.rooms ?? []).map((f) => {
    if (!roomIdSet.has(f.id)) return f
    const { joinGroupId: _dropJoin, ...rest } = f
    void _dropJoin
    return {
      ...rest,
      mergedIntoObjectId: mergedId,
      originX: minX,
      originY: minY,
      widthFt: width,
      lengthFt: height,
    }
  })

  const nextDoc: FloorPlanDoc = {
    ...doc,
    rooms: nextFrames,
    objects: nextObjects,
    objectRoom,
  }

  if (ownerRoom) {
    rebuildSpatialIndexForRoom(nextDoc, ownerRoom)
  }
  for (const f of frames) {
    if (f.id !== ownerRoom) {
      rebuildSpatialIndexForRoom(nextDoc, f.id)
    }
  }

  return {
    doc: nextDoc,
    mergedId,
  }
}

export function clearDestructiveMergeInDoc(
  doc: FloorPlanDoc,
  mergedObjectId: string
): FloorPlanDoc {
  const nextFrames = (doc.rooms ?? []).map((f) => {
    if (f.mergedIntoObjectId !== mergedObjectId) return f
    const { mergedIntoObjectId: _drop, ...rest } = f
    void _drop
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
