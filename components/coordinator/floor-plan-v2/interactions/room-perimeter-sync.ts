import {
  buildPerimeterWalls,
  PERIMETER_WALL_LABEL,
  PERIMETER_WALL_THICKNESS_FT,
  targetHasPerimeterWalls,
  type PerimeterTarget,
} from './perimeter-walls'
import { isBoothSnappedToRoomPerimeter, snapBoothToRoomPerimeter } from './perimeter-booth-orientation'
import { rotateObjectInRoom, roomFrameCenter } from '../state/rotate-room-frame'
import type { BoothObject, FloorPlanDoc, PlacedObject, RoomFrame } from '../state/types'
import type { Point } from './geometry'

export const ROOM_PERIMETER_SNAP_FT = 0.75

export function isMacroPerimeterWall(obj: PlacedObject): boolean {
  return (
    obj.kind === 'wall' &&
    obj.locked === true &&
    (obj.label ?? '').toLowerCase() === PERIMETER_WALL_LABEL.toLowerCase()
  )
}

function perimeterTargetFromFrame(frame: RoomFrame): PerimeterTarget {
  return {
    originX: frame.originX,
    originY: frame.originY,
    widthFt: frame.widthFt,
    lengthFt: frame.lengthFt,
  }
}

function wallMatchesRoom(
  obj: PlacedObject,
  target: PerimeterTarget,
  tolFt = 0.35
): boolean {
  if (!isMacroPerimeterWall(obj)) return false
  const t = PERIMETER_WALL_THICKNESS_FT
  const ox = target.originX
  const oy = target.originY
  const w = target.widthFt
  const l = target.lengthFt
  const expectations = [
    { x: ox, y: oy, w, h: t },
    { x: ox + w - t, y: oy, w: t, h: l },
    { x: ox, y: oy + l - t, w, h: t },
    { x: ox, y: oy, w: t, h: l },
  ]
  return expectations.some(
    (exp) =>
      Math.abs(obj.x - exp.x) < tolFt &&
      Math.abs(obj.y - exp.y) < tolFt &&
      Math.abs(obj.width - exp.w) < tolFt &&
      Math.abs(obj.height - exp.h) < tolFt
  )
}

/**
 * Replace macro perimeter walls for `roomId` so they magnetically match
 * the room frame outer edges. Preserves existing wall ids when count matches.
 */
export function syncPerimeterWallsToRoom(
  objects: ReadonlyArray<PlacedObject>,
  frame: RoomFrame,
  objectRoom: Record<string, string>,
  roomId: string
): { objects: PlacedObject[]; objectRoom: Record<string, string> } {
  const target = perimeterTargetFromFrame(frame)
  const hadSealed = targetHasPerimeterWalls(target, objects)
  const existingIds = objects
    .filter(
      (o) =>
        objectRoom[o.id] === roomId &&
        (isMacroPerimeterWall(o) || wallMatchesRoom(o, target))
    )
    .map((o) => o.id)

  const withoutRoomWalls = objects.filter(
    (o) =>
      !(
        objectRoom[o.id] === roomId &&
        (isMacroPerimeterWall(o) || wallMatchesRoom(o, target))
      )
  )

  if (!hadSealed && existingIds.length === 0) {
    return { objects: [...objects], objectRoom: { ...objectRoom } }
  }

  let wallIdIdx = 0
  const built = buildPerimeterWalls(target, {
    idGen: () =>
      existingIds[wallIdIdx++] ??
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `wall-${crypto.randomUUID()}`
        : `wall-${Date.now().toString(36)}`),
  })

  const nextRoom: Record<string, string> = { ...objectRoom }
  for (const id of existingIds) {
    if (!(id in nextRoom)) continue
    delete nextRoom[id]
  }
  for (const wall of built) {
    nextRoom[wall.id] = roomId
  }

  return {
    objects: [...withoutRoomWalls, ...built],
    objectRoom: nextRoom,
  }
}

/**
 * Scale / translate room-owned objects when the frame is resized.
 * Perimeter-snapped booths stay on their wall; macro walls are rebuilt separately.
 */
export function transformObjectsOnRoomResize(
  objects: ReadonlyArray<PlacedObject>,
  objectRoom: Record<string, string>,
  roomId: string,
  oldFrame: RoomFrame,
  newFrame: RoomFrame
): PlacedObject[] {
  const scaleX =
    oldFrame.widthFt > 0 ? newFrame.widthFt / oldFrame.widthFt : 1
  const scaleY =
    oldFrame.lengthFt > 0 ? newFrame.lengthFt / oldFrame.lengthFt : 1
  const dx = newFrame.originX - oldFrame.originX
  const dy = newFrame.originY - oldFrame.originY

  return objects.map((o) => {
    if (objectRoom[o.id] !== roomId) return o
    if (isMacroPerimeterWall(o)) return o

    const localX = o.x - oldFrame.originX
    const localY = o.y - oldFrame.originY
    const nx = newFrame.originX + localX * scaleX
    const ny = newFrame.originY + localY * scaleY

    if (o.kind === 'booth' && isBoothSnappedToRoomPerimeter(o as BoothObject, oldFrame)) {
      const scaled: BoothObject = {
        ...(o as BoothObject),
        x: nx,
        y: ny,
      }
      return snapBoothToRoomPerimeter(scaled, newFrame) ?? scaled
    }

    return { ...o, x: nx, y: ny } as PlacedObject
  })
}

/** Rotate every room child (including locked perimeter walls) as one group. */
export function rotateRoomChildren(
  objects: ReadonlyArray<PlacedObject>,
  objectRoom: Record<string, string>,
  roomId: string,
  roomCenter: Point,
  deltaDeg: number,
  fixDx: number,
  fixDy: number
): PlacedObject[] {
  return objects.map((o) => {
    if (objectRoom[o.id] !== roomId) return o
    const patch = rotateObjectInRoom(o, roomCenter, deltaDeg)
    return {
      ...o,
      ...patch,
      x: patch.x + fixDx,
      y: patch.y + fixDy,
    } as PlacedObject
  })
}

/**
 * After any room frame mutation, keep perimeter walls and snapped booths
 * aligned to the parent room boundary.
 */
export function reconcileRoomPerimeterChildren(
  doc: FloorPlanDoc,
  roomId: string,
  options?: { perimeterOnlyBoothOrient?: boolean }
): FloorPlanDoc {
  const frame = (doc.rooms ?? []).find((f) => f.id === roomId)
  if (!frame) return doc

  const objectRoom = { ...(doc.objectRoom ?? {}) }
  let objects = [...doc.objects]

  const synced = syncPerimeterWallsToRoom(objects, frame, objectRoom, roomId)
  objects = synced.objects
  Object.assign(objectRoom, synced.objectRoom)

  if (options?.perimeterOnlyBoothOrient) {
    objects = objects.map((o) => {
      if (o.kind !== 'booth' || objectRoom[o.id] !== roomId) return o
      const booth = o as BoothObject
      if (!isBoothSnappedToRoomPerimeter(booth, frame)) return o
      return snapBoothToRoomPerimeter(booth, frame) ?? o
    })
  }

  return { ...doc, objects, objectRoom }
}
