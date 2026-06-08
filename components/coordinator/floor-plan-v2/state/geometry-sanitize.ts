/**
 * Geometry sanitization — simple axis-aligned rooms/zones until clipper paths stabilize.
 */

import {
  findRoomIdForPlacementPoint as findRoomIdInBaseRooms,
  isValidPlacementPoint,
} from '../geometry/is-point-in-room'
import { openRingVertices } from '../geometry/point-in-polygon'
import { rotatedAabb, type Point } from '../interactions/geometry'
import type {
  FloorPlanDoc,
  MergedZoneObject,
  PlacedObject,
  RoomFrame,
} from './types'

export interface SimpleBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Clockwise rectangle: TL → TR → BR → BL → close. */
export function clockwiseRectRing(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): Array<[number, number]> {
  return [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
    [minX, minY],
  ]
}

export function roomFrameBounds(frame: RoomFrame): SimpleBounds {
  return {
    minX: frame.originX,
    minY: frame.originY,
    maxX: frame.originX + frame.widthFt,
    maxY: frame.originY + frame.lengthFt,
  }
}

export function mergedZoneGlobalBounds(obj: MergedZoneObject): SimpleBounds {
  let minX = obj.x
  let minY = obj.y
  let maxX = obj.x + obj.width
  let maxY = obj.y + obj.height
  for (const ring of obj.rings) {
    for (const pt of ring) {
      const gx = obj.x + pt[0]!
      const gy = obj.y + pt[1]!
      if (gx < minX) minX = gx
      if (gy < minY) minY = gy
      if (gx > maxX) maxX = gx
      if (gy > maxY) maxY = gy
    }
  }
  return { minX, minY, maxX, maxY }
}

export function unionBounds(boxes: ReadonlyArray<SimpleBounds>): SimpleBounds | null {
  if (boxes.length === 0) return null
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const b of boxes) {
    minX = Math.min(minX, b.minX)
    minY = Math.min(minY, b.minY)
    maxX = Math.max(maxX, b.maxX)
    maxY = Math.max(maxY, b.maxY)
  }
  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

export function pointInsideBounds(p: Point, b: SimpleBounds): boolean {
  return (
    p.x >= b.minX &&
    p.x <= b.maxX &&
    p.y >= b.minY &&
    p.y <= b.maxY
  )
}

export function vertexCountForRoom(frame: RoomFrame): number {
  if (frame.perimeterRing && frame.perimeterRing.length >= 3) {
    return openRingVertices(frame.perimeterRing).length
  }
  return 4
}

export function vertexCountForMergedZone(obj: MergedZoneObject): number {
  const ring = obj.rings[0]
  if (!ring || ring.length < 3) return 4
  return openRingVertices(ring as Array<[number, number]>).length
}

export function sanitizeRoomFrame(frame: RoomFrame): RoomFrame {
  const b = roomFrameBounds(frame)
  const preserveUnion =
    frame.perimeterRing &&
    frame.perimeterRing.length >= 3 &&
    openRingVertices(frame.perimeterRing).length > 4
  if (preserveUnion) {
    return {
      ...frame,
      originX: b.minX,
      originY: b.minY,
      widthFt: Math.max(1, b.maxX - b.minX),
      lengthFt: Math.max(1, b.maxY - b.minY),
      perimeterRing: frame.perimeterRing,
    }
  }
  const ring = clockwiseRectRing(b.minX, b.minY, b.maxX, b.maxY)
  return {
    ...frame,
    originX: b.minX,
    originY: b.minY,
    widthFt: Math.max(1, b.maxX - b.minX),
    lengthFt: Math.max(1, b.maxY - b.minY),
    perimeterRing: ring,
  }
}

/** One local-space clockwise rect; no holes or multi-ring unions. */
export function sanitizeMergedZone(obj: MergedZoneObject): MergedZoneObject {
  const global = mergedZoneGlobalBounds(obj)
  const width = Math.max(1, global.maxX - global.minX)
  const height = Math.max(1, global.maxY - global.minY)
  const localRing: number[][] = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
    [0, 0],
  ]
  return {
    ...obj,
    x: global.minX,
    y: global.minY,
    width,
    height,
    rings: [localRing],
  }
}

/**
 * Normalize every room frame and merged_zone to simple 4-vertex rectangles.
 */
export function docNeedsGeometrySanitize(doc: FloorPlanDoc): boolean {
  for (const frame of doc.rooms ?? []) {
    if (frame.mergedIntoObjectId) continue
    const verts = vertexCountForRoom(frame)
    if (verts > 4) continue
    if (verts < 4) return true
    const ringLen = frame.perimeterRing?.length ?? 0
    if (ringLen > 0 && ringLen !== 5) return true
  }
  for (const o of doc.objects) {
    if (o.kind !== 'merged_zone') continue
    if (vertexCountForMergedZone(o as MergedZoneObject) > 4) return true
    const mz = o as MergedZoneObject
    if (mz.rings.length > 1) return true
  }
  return false
}

export function forceRecomputeGeometry(doc: FloorPlanDoc): FloorPlanDoc {
  const rooms = (doc.rooms ?? []).map((f) =>
    f.mergedIntoObjectId ? f : sanitizeRoomFrame(f)
  )
  const objects = doc.objects.map((o) =>
    o.kind === 'merged_zone' ? sanitizeMergedZone(o as MergedZoneObject) : o
  )
  return { ...doc, rooms, objects }
}

export function isValidPlacementLocationBBox(
  doc: FloorPlanDoc,
  probeFt: Point,
  obj?: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>
): boolean {
  const p =
    obj != null
      ? { x: obj.x + obj.width / 2, y: obj.y + obj.height / 2 }
      : probeFt
  return isValidPlacementPoint(doc, p)
}

export function findRoomIdForPlacementPointBBox(
  doc: FloorPlanDoc,
  p: Point
): string | null {
  return findRoomIdInBaseRooms(doc, p)
}

export function unionParticipantBounds(
  frames: ReadonlyArray<RoomFrame>,
  objects: ReadonlyArray<PlacedObject>
): SimpleBounds | null {
  const boxes: SimpleBounds[] = []
  for (const f of frames) boxes.push(roomFrameBounds(f))
  for (const o of objects) {
    const aabb = rotatedAabb(o)
    boxes.push({
      minX: aabb.x,
      minY: aabb.y,
      maxX: aabb.x + aabb.width,
      maxY: aabb.y + aabb.height,
    })
  }
  return unionBounds(boxes)
}
