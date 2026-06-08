/**
 * Placement surfaces — room frame polygons and join-group unions for rotation/framing.
 * Booth placement validation uses base `doc.rooms` only (see `is-point-in-room.ts`).
 */

import {
  objectCenter,
  rotatePointAround,
  type Point,
} from '../interactions/geometry'
import {
  ensurePlacementOuterRing,
  pointInsideOuterRing,
} from '@/lib/floor-plan/placement-ring-orientation'
import { findRoomIdForPlacementPointBBox } from './geometry-sanitize'
import { buildJoinedZone } from './room-joins'
import {
  computeRoomStageUnion,
} from '@/src/utils/layoutMergeEngine'
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

const placementSurfaceCache = new WeakMap<
  FloorPlanDoc,
  Map<string, PlacementSurface | null>
>()

function placementCacheFor(doc: FloorPlanDoc): Map<string, PlacementSurface | null> {
  let cache = placementSurfaceCache.get(doc)
  if (!cache) {
    cache = new Map()
    placementSurfaceCache.set(doc, cache)
  }
  return cache
}

/**
 * Invalidate and rebuild the placement surface for a room (post-merge).
 * Ensures booth/stage drop validation uses the latest union perimeter.
 */
export function rebuildSpatialIndexForRoom(
  doc: FloorPlanDoc,
  roomId: string
): void {
  const cache = placementCacheFor(doc)
  cache.delete(roomId)
  const frame = doc.rooms?.find((f) => f.id === roomId)
  if (frame?.mergedIntoObjectId) {
    cache.delete(frame.mergedIntoObjectId)
  }
  resolveRoomPlacementSurface(doc, roomId)
}

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

export function frameToRing(frame: RoomFrame): PlacementRing {
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
  const anchor = {
    x: obj.x + obj.width / 2,
    y: obj.y + obj.height / 2,
  }
  return obj.rings.map((ring) => {
    const global = ring.map(
      ([lx, ly]) => [obj.x + lx, obj.y + ly] as [number, number]
    )
    return ensurePlacementOuterRing(global, anchor)
  })
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

/** Point-in-polygon for placement validation (global ft, union outers). */
export function pointInsidePlacementRing(
  p: Point,
  ring: PlacementRing
): boolean {
  return pointInsideOuterRing(p, ring as Array<[number, number]>)
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
  const cache = placementCacheFor(doc)
  if (cache.has(roomId)) {
    return cache.get(roomId) ?? null
  }

  const frames = doc.rooms ?? []
  const frame = frames.find((f) => f.id === roomId)
  if (!frame) {
    cache.set(roomId, null)
    return null
  }

  if (frame.perimeterRing && frame.perimeterRing.length >= 3) {
    const outerRings = [frame.perimeterRing as PlacementRing]
    const { minX, minY, maxX, maxY, centroid } = ringsBounds(outerRings)
    const surface: PlacementSurface = {
      roomId,
      outerRings,
      centroid,
      minX,
      minY,
      maxX,
      maxY,
    }
    cache.set(roomId, surface)
    return surface
  }

  const roomStageUnion = computeRoomStageUnion(doc, roomId)
  if (roomStageUnion && roomStageUnion.outerRings.length > 0) {
    const outerRings = roomStageUnion.outerRings as PlacementRing[]
    const { minX, minY, maxX, maxY, centroid } = ringsBounds(outerRings)
    const surface: PlacementSurface = {
      roomId,
      outerRings,
      centroid,
      minX,
      minY,
      maxX,
      maxY,
    }
    cache.set(roomId, surface)
    return surface
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
      const surface: PlacementSurface = {
        roomId,
        outerRings,
        centroid,
        minX,
        minY,
        maxX,
        maxY,
      }
      cache.set(roomId, surface)
      return surface
    }
  }

  const outerRings = [frameToRing(frame)]
  const { minX, minY, maxX, maxY, centroid } = ringsBounds(outerRings)
  const surface: PlacementSurface = {
    roomId,
    outerRings,
    centroid,
    minX,
    minY,
    maxX,
    maxY,
  }
  cache.set(roomId, surface)
  return surface
}

/** Pick the topmost room whose placement bounds contain `p`. */
export function findRoomIdForPlacementPoint(
  doc: FloorPlanDoc,
  p: Point
): string | null {
  return findRoomIdForPlacementPointBBox(doc, p)
}

/** Geometric pivot for room rotation (union centroid, not stale AABB center). */
export function roomRotationPivot(doc: FloorPlanDoc, roomId: string): Point {
  const frame = doc.rooms?.find((f) => f.id === roomId)
  if (frame?.perimeterRing && frame.perimeterRing.length >= 3) {
    return ringCentroid(frame.perimeterRing)
  }
  const surface = resolveRoomPlacementSurface(doc, roomId)
  if (surface) return surface.centroid
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
  const sourcePts: Point[] =
    frame.perimeterRing && frame.perimeterRing.length >= 3
      ? frame.perimeterRing
          .filter((_, i, arr) => {
            if (i === arr.length - 1 && arr.length > 1) {
              const a = arr[0]!
              const b = arr[i]!
              return a[0] === b[0] && a[1] === b[1]
            }
            return true
          })
          .map(([x, y]) => ({ x, y }))
      : [
          { x: frame.originX, y: frame.originY },
          { x: frame.originX + frame.widthFt, y: frame.originY },
          {
            x: frame.originX + frame.widthFt,
            y: frame.originY + frame.lengthFt,
          },
          { x: frame.originX, y: frame.originY + frame.lengthFt },
        ]
  const rotated = sourcePts.map((c) => rotatePointAround(c, pivot, delta))
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
  const perimeterRing: PlacementRing | undefined =
    frame.perimeterRing && frame.perimeterRing.length >= 3
      ? [
          ...rotated.map((p) => [p.x, p.y] as [number, number]),
          [rotated[0]!.x, rotated[0]!.y] as [number, number],
        ]
      : frame.perimeterRing
  return {
    ...frame,
    originX: minX,
    originY: minY,
    widthFt: Math.max(1e-6, maxX - minX),
    lengthFt: Math.max(1e-6, maxY - minY),
    perimeterRing,
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
