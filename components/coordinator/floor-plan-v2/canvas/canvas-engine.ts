/**
 * Canvas engine — deterministic room list, placement validation, and viewport math.
 * Single source of truth: `doc.rooms` with no ghost frames after merge.
 */

import { objectCenter, type Point } from '../interactions/geometry'
import {
  findRoomIdForPlacementPoint,
  pointInsidePlacementSurface,
  resolveRoomPlacementSurface,
  roomRotationPivot,
} from '../state/placement-surface'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from '../state/types'

export const MAIN_HALL_ROOM_ID = 'main-hall'
export const DEFAULT_MAIN_HALL_SIZE_FT = 50

export interface ViewportMatrix {
  zoom: number
  panX: number
  panY: number
}

export interface RoomBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Rooms that participate in hit-testing and rendering (no merge ghosts). */
export function activeRoomFrames(doc: FloorPlanDoc): RoomFrame[] {
  return (doc.rooms ?? []).filter((f) => !f.mergedIntoObjectId)
}

/**
 * Union bounding box of all active room placement surfaces (ft).
 * Used by Center View when the canvas has no placed objects yet.
 */
export function unionActiveRoomBounds(doc: FloorPlanDoc): RoomBounds | null {
  const frames = activeRoomFrames(doc)
  if (frames.length === 0) return null

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const frame of frames) {
    const surface = resolveRoomPlacementSurface(doc, frame.id)
    if (surface) {
      minX = Math.min(minX, surface.minX)
      minY = Math.min(minY, surface.minY)
      maxX = Math.max(maxX, surface.maxX)
      maxY = Math.max(maxY, surface.maxY)
      continue
    }
    minX = Math.min(minX, frame.originX)
    minY = Math.min(minY, frame.originY)
    maxX = Math.max(maxX, frame.originX + frame.widthFt)
    maxY = Math.max(maxY, frame.originY + frame.lengthFt)
  }

  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

export function boundsCentroid(bounds: RoomBounds): Point {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  }
}

/**
 * Strict placement gate: drops must land inside a room perimeter polygon.
 * Empty canvas background (outside all room unions) is always rejected.
 */
export function isValidPlacementLocation(
  doc: FloorPlanDoc,
  probeFt: Point,
  obj?: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'>
): boolean {
  const p = obj ? objectCenter(obj as PlacedObject) : probeFt
  const roomId = findRoomIdForPlacementPoint(doc, p)
  if (!roomId) return false
  const surface = resolveRoomPlacementSurface(doc, roomId)
  if (!surface) return false
  return pointInsidePlacementSurface(p, surface)
}

/** Geometric pivot for room rotation (union centroid when merged). */
export function roomGeometricCentroid(
  doc: FloorPlanDoc,
  roomId: string
): Point {
  return roomRotationPivot(doc, roomId)
}

export function makeDefaultMainHallFrame(): RoomFrame {
  return {
    id: MAIN_HALL_ROOM_ID,
    name: 'Main Hall',
    originX: 0,
    originY: 0,
    widthFt: DEFAULT_MAIN_HALL_SIZE_FT,
    lengthFt: DEFAULT_MAIN_HALL_SIZE_FT,
  }
}

/**
 * Infinite-void safeguard — never leave the doc without a placeable room.
 */
export function ensureCanvasHasPlaceableRoom(doc: FloorPlanDoc): FloorPlanDoc {
  const active = activeRoomFrames(doc)
  if (active.length > 0) return doc
  const hall = makeDefaultMainHallFrame()
  return {
    ...doc,
    canvasWidthFt: Math.max(doc.canvasWidthFt, DEFAULT_MAIN_HALL_SIZE_FT),
    canvasLengthFt: Math.max(doc.canvasLengthFt, DEFAULT_MAIN_HALL_SIZE_FT),
    rooms: [hall],
    objectRoom: { ...(doc.objectRoom ?? {}) },
  }
}
