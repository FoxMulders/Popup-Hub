/**
 * Snap doors and emergency exits flush to the nearest exterior wall segment.
 */

import { rotatedAabb, type Point } from './geometry'
import type { PlacedObject, RoomFrame } from '../state/types'
import type { RoomEdgeSide } from './perimeter-booth-orientation'

/** Wall-tangent rotation — door span runs along the wall axis. */
const WALL_TANGENT_ROTATION: Record<RoomEdgeSide, number> = {
  top: 0,
  right: 90,
  bottom: 0,
  left: 90,
}

export function isStructuralWallSnapKind(
  kind: PlacedObject['kind']
): kind is 'door' | 'emergency_exit' {
  return kind === 'door' || kind === 'emergency_exit'
}

function nearestWallSideLocal(
  center: Point,
  roomW: number,
  roomH: number
): RoomEdgeSide {
  const distTop = center.y
  const distBottom = roomH - center.y
  const distLeft = center.x
  const distRight = roomW - center.x
  const min = Math.min(distTop, distBottom, distLeft, distRight)
  if (min === distTop) return 'top'
  if (min === distRight) return 'right'
  if (min === distBottom) return 'bottom'
  return 'left'
}

/**
 * Snap a door/exit to the nearest room perimeter wall in room-local
 * coordinates (`x ∈ [0, roomW]`, `y ∈ [0, roomH]`).
 */
export function snapStructuralAssetToLocalPerimeter(
  obj: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'kind'>,
  roomW: number,
  roomH: number
): Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation'> {
  const center = {
    x: obj.x + obj.width / 2,
    y: obj.y + obj.height / 2,
  }
  const side = nearestWallSideLocal(center, roomW, roomH)
  const rotation = WALL_TANGENT_ROTATION[side]

  let patched = { ...obj, rotation }
  let aabb = rotatedAabb(patched as PlacedObject)

  let x = patched.x
  let y = patched.y

  switch (side) {
    case 'top':
      y += -aabb.y
      break
    case 'bottom':
      y += roomH - (aabb.y + aabb.height)
      break
    case 'left':
      x += -aabb.x
      break
    case 'right':
      x += roomW - (aabb.x + aabb.width)
      break
  }

  patched = { ...patched, x, y }
  aabb = rotatedAabb(patched as PlacedObject)

  if (side === 'top' || side === 'bottom') {
    const span = aabb.width
    let ax = aabb.x
    if (span > roomW) ax = 0
    else if (ax < 0) ax = 0
    else if (ax + span > roomW) ax = roomW - span
    x += ax - aabb.x
  } else {
    const span = aabb.height
    let ay = aabb.y
    if (span > roomH) ay = 0
    else if (ay < 0) ay = 0
    else if (ay + span > roomH) ay = roomH - span
    y += ay - aabb.y
  }

  return { ...patched, x, y, rotation }
}

/** Snap using a room frame's global origin and dimensions. */
export function snapStructuralAssetToRoomFrame(
  obj: PlacedObject,
  frame: RoomFrame
): Partial<PlacedObject> {
  const local = {
    ...obj,
    x: obj.x - frame.originX,
    y: obj.y - frame.originY,
  }
  const snapped = snapStructuralAssetToLocalPerimeter(
    local,
    frame.widthFt,
    frame.lengthFt
  )
  return {
    x: frame.originX + snapped.x!,
    y: frame.originY + snapped.y!,
    rotation: snapped.rotation,
  }
}

export function snapStructuralAssetForDoc(
  obj: PlacedObject,
  doc: { rooms?: RoomFrame[]; objectRoom?: Record<string, string> }
): Partial<PlacedObject> | null {
  if (!isStructuralWallSnapKind(obj.kind)) return null
  const roomId = doc.objectRoom?.[obj.id]
  const rooms = doc.rooms ?? []
  let frame: RoomFrame | null = null
  if (roomId) {
    frame = rooms.find((r) => r.id === roomId) ?? null
  }
  if (!frame && rooms.length === 1) frame = rooms[0]!
  if (!frame) {
    frame = {
      id: '__canvas__',
      name: 'Canvas',
      originX: 0,
      originY: 0,
      widthFt: 0,
      lengthFt: 0,
    }
    for (const r of rooms) {
      if (!frame) continue
      frame.widthFt = Math.max(frame.widthFt, r.originX + r.widthFt - frame.originX)
      frame.lengthFt = Math.max(
        frame.lengthFt,
        r.originY + r.lengthFt - frame.originY
      )
    }
    if (frame.widthFt <= 0 || frame.lengthFt <= 0) return null
  }
  return snapStructuralAssetToRoomFrame(obj, frame)
}
