/**
 * Canvas engine — deterministic room list, placement validation, and viewport math.
 * Single source of truth: `doc.rooms` with no ghost frames after merge.
 */

import { objectCenter, type Point } from '../interactions/geometry'
import {
  isPointInRoom,
  isPointInRoomForObject,
} from '../geometry/is-point-in-room'
import {
  pointInAnyRing,
  pointInPolygon,
  ringBounds,
  ringCentroid,
} from '../geometry/point-in-polygon'
import { frameToRing } from '../state/placement-surface'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from '../state/types'

export const MAIN_HALL_ROOM_ID = 'main-hall'
export const DEFAULT_MAIN_HALL_SIZE_FT = 50

export interface ViewportMatrix {
  zoom: number
  panX: number
  panY: number
}

export type LayoutViewportMatrix = ViewportMatrix

export interface RoomBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Active rooms only — no merge ghosts or hidden guides. */
export function activeRoomFrames(doc: FloorPlanDoc): RoomFrame[] {
  return (doc.rooms ?? []).filter((r) => !r.mergedIntoObjectId)
}

export const layoutRooms = activeRoomFrames

function roomOuterRings(
  frame: RoomFrame
): ReadonlyArray<ReadonlyArray<readonly [number, number]>> {
  if (frame.perimeterRing && frame.perimeterRing.length >= 3) {
    return [frame.perimeterRing]
  }
  return [frameToRing(frame)]
}

/**
 * Strict placement: inside any active room polygon ⇒ true; background ⇒ false.
 */
export function isValidPlacementLocation(
  doc: FloorPlanDoc,
  probeFt: Point,
  obj?: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>
): boolean {
  if (obj) {
    return isPointInRoomForObject(doc, obj)
  }
  return isPointInRoom(doc, probeFt.x, probeFt.y)
}

export { isPointInRoom, isPointInRoomForObject }

export function unionActiveRoomBounds(doc: FloorPlanDoc): RoomBounds | null {
  const rooms = activeRoomFrames(doc)
  if (rooms.length === 0) return null

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const frame of rooms) {
    for (const ring of roomOuterRings(frame)) {
      const b = ringBounds(ring)
      minX = Math.min(minX, b.minX)
      minY = Math.min(minY, b.minY)
      maxX = Math.max(maxX, b.maxX)
      maxY = Math.max(maxY, b.maxY)
    }
  }

  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

export const unionRoomBounds = unionActiveRoomBounds

export function boundsCentroid(bounds: RoomBounds): Point {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }
}

export const boundsCenter = boundsCentroid

export function roomGeometricCentroid(
  doc: FloorPlanDoc,
  roomId: string
): Point {
  const frame = activeRoomFrames(doc).find((r) => r.id === roomId)
  if (!frame) return { x: 0, y: 0 }
  const rings = roomOuterRings(frame)
  if (rings[0]) return ringCentroid(rings[0])
  return {
    x: frame.originX + frame.widthFt / 2,
    y: frame.originY + frame.lengthFt / 2,
  }
}

export const roomPerimeterCentroid = roomGeometricCentroid

export function makeDefaultMainHallFrame(): RoomFrame {
  const ring: Array<[number, number]> = [
    [0, 0],
    [DEFAULT_MAIN_HALL_SIZE_FT, 0],
    [DEFAULT_MAIN_HALL_SIZE_FT, DEFAULT_MAIN_HALL_SIZE_FT],
    [0, DEFAULT_MAIN_HALL_SIZE_FT],
    [0, 0],
  ]
  return {
    id: MAIN_HALL_ROOM_ID,
    name: 'Main Hall',
    originX: 0,
    originY: 0,
    widthFt: DEFAULT_MAIN_HALL_SIZE_FT,
    lengthFt: DEFAULT_MAIN_HALL_SIZE_FT,
    perimeterRing: ring,
  }
}

export const makeDefaultMainHall = makeDefaultMainHallFrame

export function ensureCanvasHasPlaceableRoom(doc: FloorPlanDoc): FloorPlanDoc {
  if (activeRoomFrames(doc).length > 0) return doc
  const hall = makeDefaultMainHallFrame()
  return {
    ...doc,
    canvasWidthFt: Math.max(doc.canvasWidthFt, DEFAULT_MAIN_HALL_SIZE_FT),
    canvasLengthFt: Math.max(doc.canvasLengthFt, DEFAULT_MAIN_HALL_SIZE_FT),
    rooms: [hall],
    objectRoom: { ...(doc.objectRoom ?? {}) },
  }
}

export const ensureLayoutNotVoid = ensureCanvasHasPlaceableRoom

export function findRoomAtPoint(
  doc: FloorPlanDoc,
  p: Point
): string | null {
  const rooms = activeRoomFrames(doc)
  for (let i = rooms.length - 1; i >= 0; i--) {
    const frame = rooms[i]!
    if (pointInAnyRing(p, roomOuterRings(frame))) return frame.id
  }
  return null
}

export { pointInPolygon }
