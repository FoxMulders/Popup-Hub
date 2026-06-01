/**
 * Canvas bootstrap — default Main Hall and void recovery (no placement cache).
 */

import { frameToRing } from './placement-surface'
import type { FloorPlanDoc, RoomFrame } from './types'

export const MAIN_HALL_ROOM_ID = 'main-hall'
export const DEFAULT_MAIN_HALL_SIZE_FT = 50

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
  const rooms = (doc.rooms ?? []).filter((r) => !r.mergedIntoObjectId)
  if (rooms.length > 0) return doc
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
