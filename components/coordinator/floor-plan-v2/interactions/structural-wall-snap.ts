/**
 * Snap doors and emergency exits flush to the nearest exterior wall segment.
 * The door's long edge runs along the wall; the short edge is the wall depth.
 */

import { rotatedAabb, snapToGrid, type Point, type Rect } from './geometry'
import type { FloorPlanDoc, PlacedObject, RoomFrame } from '../state/types'
import type { RoomEdgeSide } from './perimeter-booth-orientation'
import type { PlacementProbe } from '../geometry/is-point-in-room'

/** Typical door opening span along the wall (ft). */
export const DEFAULT_STRUCTURAL_DOOR_WIDTH_FT = 3

/** Typical door jamb depth perpendicular to the wall (ft). */
export const DEFAULT_STRUCTURAL_DOOR_DEPTH_FT = 1

/** Wall-tangent rotation — local width runs along the wall axis. */
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

export function defaultStructuralDoorFootprintFt(): { width: number; height: number } {
  return {
    width: DEFAULT_STRUCTURAL_DOOR_WIDTH_FT,
    height: DEFAULT_STRUCTURAL_DOOR_DEPTH_FT,
  }
}

/**
 * Ensure local `width` is the long span so it aligns with the wall tangent
 * at the target rotation (0° for horizontal walls, 90° for vertical).
 */
export function orientLongEdgeAlongWall(
  width: number,
  height: number
): { width: number; height: number } {
  if (width < height) {
    return { width: height, height: width }
  }
  return { width, height }
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
  const oriented = orientLongEdgeAlongWall(obj.width, obj.height)

  let patched = { ...obj, ...oriented, rotation }
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
    width: snapped.width,
    height: snapped.height,
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

/** Resolve the room whose perimeter is nearest to `p` (for wall-snapped fixtures). */
export function findRoomIdForStructuralPlacement(
  doc: Pick<FloorPlanDoc, 'rooms'>,
  p: { x: number; y: number },
  preferredRoomId?: string | null
): string | null {
  const rooms = (doc.rooms ?? []).filter((r) => !r.mergedIntoObjectId)
  if (rooms.length === 0) return null

  let bestId: string | null = null
  let bestDist = Number.POSITIVE_INFINITY

  for (const frame of rooms) {
    const localX = p.x - frame.originX
    const localY = p.y - frame.originY
    const w = frame.widthFt
    const h = frame.lengthFt
    const dx = localX < 0 ? -localX : localX > w ? localX - w : 0
    const dy = localY < 0 ? -localY : localY > h ? localY - h : 0
    const dist = Math.hypot(dx, dy)
    if (dist < bestDist) {
      bestDist = dist
      bestId = frame.id
    }
  }

  if (
    preferredRoomId &&
    rooms.some((r) => r.id === preferredRoomId) &&
    bestDist <= 8
  ) {
    const preferred = rooms.find((r) => r.id === preferredRoomId)!
    const localX = p.x - preferred.originX
    const localY = p.y - preferred.originY
    const dx =
      localX < 0
        ? -localX
        : localX > preferred.widthFt
          ? localX - preferred.widthFt
          : 0
    const dy =
      localY < 0
        ? -localY
        : localY > preferred.lengthFt
          ? localY - preferred.lengthFt
          : 0
    if (Math.hypot(dx, dy) <= bestDist + 0.5) return preferredRoomId
  }

  return bestId
}

export type StructuralPlacementPreview = Rect & { rotation: number }

/** Draw/hover preview — default footprint + nearest-wall snap. */
export function resolveStructuralPlacementPreview(
  kind: PlacedObject['kind'],
  rect: Rect,
  doc: Pick<FloorPlanDoc, 'rooms' | 'objectRoom'>,
  activeRoomId: string | null | undefined
): StructuralPlacementPreview | null {
  if (!isStructuralWallSnapKind(kind)) return null

  const { width, height } = defaultStructuralDoorFootprintFt()
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const probe: PlacementProbe = {
    kind,
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
    rotation: 0,
  }

  const roomId =
    findRoomIdForStructuralPlacement(doc, { x: cx, y: cy }, activeRoomId) ??
    activeRoomId ??
    doc.rooms?.[0]?.id ??
    null
  const frame = roomId ? doc.rooms?.find((r) => r.id === roomId) : null
  if (!frame) {
    return { ...probe, rotation: 0 }
  }

  const local = snapStructuralAssetToLocalPerimeter(
    {
      ...probe,
      x: probe.x - frame.originX,
      y: probe.y - frame.originY,
    },
    frame.widthFt,
    frame.lengthFt
  )
  return {
    x: frame.originX + local.x!,
    y: frame.originY + local.y!,
    width: local.width ?? width,
    height: local.height ?? height,
    rotation: local.rotation ?? 0,
  }
}

/** Live drag patch — grid snap then flush to nearest wall (no booth clearance). */
export function structuralLayoutMovePatch(
  obj: PlacedObject,
  origin: { x: number; y: number },
  totalDx: number,
  totalDy: number,
  doc: Pick<FloorPlanDoc, 'rooms' | 'objectRoom' | 'snapFt'>,
  activeRoomId: string | null | undefined,
  snapFt: number
): Partial<PlacedObject> {
  const gridFt = snapFt > 0 ? snapFt : doc.snapFt > 0 ? doc.snapFt : 1
  const moved = {
    ...obj,
    x: snapToGrid(origin.x + totalDx, gridFt),
    y: snapToGrid(origin.y + totalDy, gridFt),
  }
  const roomId = doc.objectRoom?.[obj.id] ?? activeRoomId ?? null
  const frame = roomId ? doc.rooms?.find((r) => r.id === roomId) : null
  if (frame) {
    return snapStructuralAssetToRoomFrame(moved, frame)
  }
  const snap = snapStructuralAssetForDoc(moved, doc)
  return snap ?? { x: moved.x, y: moved.y }
}
