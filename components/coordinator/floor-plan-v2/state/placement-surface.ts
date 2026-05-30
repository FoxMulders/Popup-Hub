/**
 * Placement surfaces — union perimeters for drop validation and room rotation.
 * Uses merged_zone rings / join-group unions instead of historic rectangular frames.
 */

import {
  objectCenter,
  rotatePointAround,
  type Point,
} from '../interactions/geometry'
import { buildJoinedZone } from './room-joins'
import { stripMacroPerimeterWallsFromDoc } from '../interactions/room-perimeter-sync'
import { rotateObjectInRoom } from './rotate-room-frame'
import { reconcileCanvasExtents } from './room-canvas'
import type {
  FloorPlanDoc,
  MergedZoneObject,
  PlacedObject,
  RoomFrame,
} from './types'

export type PlacementRing = ReadonlyArray<readonly [number, number]>

export interface PlacementSurface {
  roomId: string
  /** Closed outer rings in global canvas feet (first = primary boundary). */
  outerRings: PlacementRing[]
  centroid: Point
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function frameToRing(frame: RoomFrame): PlacementRing {
  const x0 = frame.originX
  const y0 = frame.originY
  const x1 = x0 + frame.widthFt
  const y1 = y0 + frame.lengthFt
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
    [x0, y0],
  ]
}

function mergedZoneGlobalRings(obj: MergedZoneObject): PlacementRing[] {
  return obj.rings.map((ring) =>
    ring.map(([lx, ly]) => [obj.x + lx, obj.y + ly] as [number, number])
  )
}

function ringCentroid(ring: PlacementRing): Point {
  const pts = ring.length > 1 && ring[0]![0] === ring[ring.length - 1]![0] &&
    ring[0]![1] === ring[ring.length - 1]![1]
    ? ring.slice(0, -1)
    : ring
  if (pts.length === 0) return { x: 0, y: 0 }
  let sx = 0
  let sy = 0
  for (const p of pts) {
    sx += p[0]
    sy += p[1]
  }
  return { x: sx / pts.length, y: sy / pts.length }
}

function ringsBounds(rings: ReadonlyArray<PlacementRing>): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  centroid: Point
} {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  const centroids: Point[] = []
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
    centroids.push(ringCentroid(ring))
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, centroid: { x: 0, y: 0 } }
  }
  const centroid =
    centroids.length === 1
      ? centroids[0]!
      : {
          x: centroids.reduce((s, p) => s + p.x, 0) / centroids.length,
          y: centroids.reduce((s, p) => s + p.y, 0) / centroids.length,
        }
  return { minX, minY, maxX, maxY, centroid }
}

/** Ray-cast point-in-polygon (global ft). */
export function pointInsidePlacementRing(
  p: Point,
  ring: PlacementRing,
  epsilon = 0.05
): boolean {
  const pts =
    ring.length > 1 &&
    ring[0]![0] === ring[ring.length - 1]![0] &&
    ring[0]![1] === ring[ring.length - 1]![1]
      ? ring.slice(0, -1)
      : [...ring]
  if (pts.length < 3) return false

  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i]![0]
    const yi = pts[i]![1]
    const xj = pts[j]![0]
    const yj = pts[j]![1]
    const intersect =
      yi > p.y + epsilon !== yj > p.y + epsilon &&
      p.x + epsilon <
        ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function pointInsidePlacementSurface(
  p: Point,
  surface: PlacementSurface
): boolean {
  for (const ring of surface.outerRings) {
    if (pointInsidePlacementRing(p, ring)) return true
  }
  return false
}

/** True when the probe center lies inside the room's active placement surface. */
export function objectCenterInsidePlacementSurface(
  obj: PlacedObject,
  surface: PlacementSurface
): boolean {
  return pointInsidePlacementSurface(objectCenter(obj), surface)
}

export function resolveRoomPlacementSurface(
  doc: FloorPlanDoc,
  roomId: string
): PlacementSurface | null {
  const frames = doc.rooms ?? []
  const frame = frames.find((f) => f.id === roomId)
  if (!frame) return null

  if (frame.mergedIntoObjectId) {
    const mz = doc.objects.find(
      (o): o is MergedZoneObject =>
        o.id === frame.mergedIntoObjectId && o.kind === 'merged_zone'
    )
    if (mz && mz.rings.length > 0) {
      const outerRings = mergedZoneGlobalRings(mz)
      const { minX, minY, maxX, maxY, centroid } = ringsBounds(outerRings)
      return { roomId, outerRings, centroid, minX, minY, maxX, maxY }
    }
  }

  if (frame.joinGroupId) {
    const groupFrames = frames.filter((f) => f.joinGroupId === frame.joinGroupId)
    const groupObjects = doc.objects.filter(
      (o) => o.joinGroupId === frame.joinGroupId
    )
    const zone = buildJoinedZone(frame.joinGroupId, groupFrames, groupObjects)
    if (zone && zone.rings.length > 0) {
      const outerRings = zone.rings as PlacementRing[]
      const { minX, minY, maxX, maxY, centroid } = ringsBounds(outerRings)
      return { roomId, outerRings, centroid, minX, minY, maxX, maxY }
    }
  }

  const outerRings = [frameToRing(frame)]
  const { minX, minY, maxX, maxY, centroid } = ringsBounds(outerRings)
  return { roomId, outerRings, centroid, minX, minY, maxX, maxY }
}

/** Pick the topmost room whose placement surface contains `p`. */
export function findRoomIdForPlacementPoint(
  doc: FloorPlanDoc,
  p: Point
): string | null {
  const frames = doc.rooms ?? []
  for (let i = frames.length - 1; i >= 0; i--) {
    const f = frames[i]!
    if (f.mergedIntoObjectId) {
      const surface = resolveRoomPlacementSurface(doc, f.id)
      if (surface && pointInsidePlacementSurface(p, surface)) return f.id
      continue
    }
    const surface = resolveRoomPlacementSurface(doc, f.id)
    if (surface && pointInsidePlacementSurface(p, surface)) return f.id
  }
  return null
}

/** Geometric pivot for room rotation (union centroid, not stale AABB center). */
export function roomRotationPivot(doc: FloorPlanDoc, roomId: string): Point {
  const surface = resolveRoomPlacementSurface(doc, roomId)
  if (surface) return surface.centroid
  const frame = doc.rooms?.find((f) => f.id === roomId)
  if (!frame) return { x: 0, y: 0 }
  return {
    x: frame.originX + frame.widthFt / 2,
    y: frame.originY + frame.lengthFt / 2,
  }
}

export function placementSurfaceFramingBounds(surface: PlacementSurface): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  return {
    minX: surface.minX,
    minY: surface.minY,
    maxX: surface.maxX,
    maxY: surface.maxY,
  }
}

/** Rotate a room frame 90° around `pivot`; origin/size follow the rotated AABB. */
export function rotateRoomFrameAroundPivot(
  frame: RoomFrame,
  pivot: Point,
  direction: 'cw' | 'ccw'
): RoomFrame {
  const delta = direction === 'cw' ? 90 : -90
  const corners: Point[] = [
    { x: frame.originX, y: frame.originY },
    { x: frame.originX + frame.widthFt, y: frame.originY },
    { x: frame.originX + frame.widthFt, y: frame.originY + frame.lengthFt },
    { x: frame.originX, y: frame.originY + frame.lengthFt },
  ]
  const rotated = corners.map((c) => rotatePointAround(c, pivot, delta))
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const c of rotated) {
    if (c.x < minX) minX = c.x
    if (c.y < minY) minY = c.y
    if (c.x > maxX) maxX = c.x
    if (c.y > maxY) maxY = c.y
  }
  return {
    ...frame,
    originX: minX,
    originY: minY,
    widthFt: Math.max(1e-6, maxX - minX),
    lengthFt: Math.max(1e-6, maxY - minY),
  }
}

function rotateMergedZoneObject(
  obj: MergedZoneObject,
  pivot: Point,
  deltaDeg: number
): MergedZoneObject {
  const globalRings = mergedZoneGlobalRings(obj).map((ring) =>
    ring.map(([x, y]) => {
      const r = rotatePointAround({ x, y }, pivot, deltaDeg)
      return [r.x, r.y] as [number, number]
    })
  )
  const { minX, minY, maxX, maxY } = ringsBounds(globalRings)
  const localRings = globalRings.map((ring) =>
    ring.map(([x, y]) => [x - minX, y - minY] as [number, number])
  )
  return {
    ...obj,
    x: minX,
    y: minY,
    width: Math.max(1e-6, maxX - minX),
    height: Math.max(1e-6, maxY - minY),
    rings: localRings,
  }
}

/**
 * Rotate room-owned objects (and merged_zone when present) around the placement pivot.
 */
export function rotateRoomContentsAroundPivot(
  doc: FloorPlanDoc,
  roomId: string,
  pivot: Point,
  direction: 'cw' | 'ccw'
): PlacedObject[] {
  const deltaDeg = direction === 'cw' ? 90 : -90
  const objectRoom = doc.objectRoom ?? {}
  const frame = doc.rooms?.find((f) => f.id === roomId)
  const mergeId = frame?.mergedIntoObjectId

  return doc.objects.map((o) => {
    if (mergeId && o.id === mergeId && o.kind === 'merged_zone') {
      return rotateMergedZoneObject(o as MergedZoneObject, pivot, deltaDeg)
    }
    if (objectRoom[o.id] !== roomId) return o
    const patch = rotateObjectInRoom(o, pivot, deltaDeg)
    return { ...o, ...patch } as PlacedObject
  })
}

/**
 * Strip legacy perimeter walls, refresh canvas extents, return finalized doc.
 */
export function finalizeDocGeometry(doc: FloorPlanDoc): FloorPlanDoc {
  let next = stripMacroPerimeterWallsFromDoc(doc)
  const extents = reconcileCanvasExtents(
    next.rooms ?? [],
    undefined,
    next.objects
  )
  next = {
    ...next,
    canvasWidthFt: extents.canvasWidthFt,
    canvasLengthFt: extents.canvasLengthFt,
  }
  return next
}
