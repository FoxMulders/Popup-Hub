/**
 * Canvas engine — room list helpers and viewport math.
 * Placement validation lives in `state/use-floor-plan-doc.ts`.
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
import {
  DEFAULT_MAIN_HALL_SIZE_FT,
  ensureCanvasHasPlaceableRoom,
  ensureLayoutNotVoid,
  MAIN_HALL_ROOM_ID,
  makeDefaultMainHallFrame,
  makeDefaultMainHall,
} from '../state/canvas-init'
import { isValidPlacementLocation } from '../state/use-floor-plan-doc'

export {
  DEFAULT_MAIN_HALL_SIZE_FT,
  ensureCanvasHasPlaceableRoom,
  ensureLayoutNotVoid,
  MAIN_HALL_ROOM_ID,
  makeDefaultMainHallFrame,
  makeDefaultMainHall,
  isValidPlacementLocation,
}

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
