import { objectCenter, rotatePointAround, type Point } from '../interactions/geometry'
import type { PlacedObject, RoomFrame } from './types'

/** Geometric center of a room frame rectangle in canvas-global feet. */
export function roomFrameCenter(frame: RoomFrame): Point {
  return {
    x: frame.originX + frame.widthFt / 2,
    y: frame.originY + frame.lengthFt / 2,
  }
}

/** Normalize rotation to [-180, 180] — matches object toolbar rotate. */
export function normalizeRotationDeg(deg: number): number {
  let next = deg % 360
  if (next > 180) next -= 360
  if (next <= -180) next += 360
  return next
}

/**
 * Rotate a room frame 90° around its center. Swaps width/length and
 * recomputes origin so the center stays fixed. Axis-aligned frames
 * produce the same bounding box for cw and ccw; object rotation uses
 * the signed delta from `roomRotateDeltaDeg`.
 */
export function rotateRoomFrame90(
  frame: RoomFrame,
  _direction: 'cw' | 'ccw'
): RoomFrame {
  const center = roomFrameCenter(frame)
  const widthFt = frame.lengthFt
  const lengthFt = frame.widthFt
  return {
    ...frame,
    originX: center.x - widthFt / 2,
    originY: center.y - lengthFt / 2,
    widthFt,
    lengthFt,
  }
}

export function roomRotateDeltaDeg(direction: 'cw' | 'ccw'): number {
  return direction === 'cw' ? 90 : -90
}

/**
 * Rotate one placed object around `roomCenter` by `deltaDeg`, updating
 * position and object rotation together.
 */
export function rotateObjectInRoom(
  obj: PlacedObject,
  roomCenter: Point,
  deltaDeg: number
): Pick<PlacedObject, 'x' | 'y' | 'rotation'> {
  const center = objectCenter(obj)
  const rotatedCenter = rotatePointAround(center, roomCenter, deltaDeg)
  return {
    x: rotatedCenter.x - obj.width / 2,
    y: rotatedCenter.y - obj.height / 2,
    rotation: normalizeRotationDeg((obj.rotation || 0) + deltaDeg),
  }
}
