import { PERIMETER_WALL_LABEL } from './perimeter-walls'
import { isBoothSnappedToRoomPerimeter, snapBoothToRoomPerimeter } from './perimeter-booth-orientation'
import { rotateObjectInRoom, roomFrameCenter } from '../state/rotate-room-frame'
import type { BoothObject, FloorPlanDoc, PlacedObject, RoomFrame } from '../state/types'
import type { Point } from './geometry'

export const ROOM_PERIMETER_SNAP_FT = 0.75

export function isMacroPerimeterWall(obj: PlacedObject): boolean {
  return (
    obj.kind === 'wall' &&
    (obj.label ?? '').toLowerCase() === PERIMETER_WALL_LABEL.toLowerCase()
  )
}

/** Remove legacy macro perimeter wall objects from a floor-plan document. */
export function stripMacroPerimeterWallsFromDoc(doc: FloorPlanDoc): FloorPlanDoc {
  const objectRoom = doc.objectRoom ?? {}
  const objects = doc.objects.filter((o) => {
    if (!isMacroPerimeterWall(o)) return true
    return false
  })
  if (objects.length === doc.objects.length) return doc
  const nextRoom = { ...objectRoom }
  for (const o of doc.objects) {
    if (isMacroPerimeterWall(o)) delete nextRoom[o.id]
  }
  return { ...doc, objects, objectRoom: nextRoom }
}

/**
 * Drop macro perimeter walls for `roomId` (room boundary is the frame stroke).
 */
export function syncPerimeterWallsToRoom(
  objects: ReadonlyArray<PlacedObject>,
  _frame: RoomFrame,
  objectRoom: Record<string, string>,
  roomId: string
): { objects: PlacedObject[]; objectRoom: Record<string, string> } {
  const nextRoom = { ...objectRoom }
  const nextObjects = objects.filter((o) => {
    if (objectRoom[o.id] !== roomId) return true
    if (!isMacroPerimeterWall(o)) return true
    delete nextRoom[o.id]
    return false
  })
  return { objects: nextObjects, objectRoom: nextRoom }
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
