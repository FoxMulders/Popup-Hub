/**
 * Validates entry/exit doors on perimeter walls before unified auto-arrange.
 */

import { isObjectInRoom } from '../geometry/is-point-in-room'
import { rotatedAabb } from '../interactions/geometry'
import { resolveRoomPlacementSurface } from '../state/placement-surface'
import type {
  DoorObject,
  FloorPlanDoc,
  PlacedObject,
} from '../state/types'

/** Max distance (ft) from a room edge for a door/exit to count as perimeter-snapped. */
export const PERIMETER_DOOR_SNAP_TOLERANCE_FT = 1.5

export const AUTO_ARRANGE_NEEDS_BOOTHS_TOOLTIP =
  'Place tables with Vendor Booths or Patron Tables — generic Shapes (walls, stages, labels) are not auto-arranged.'

export const AUTO_ARRANGE_WRONG_ROOM_TOOLTIP =
  'Switch to the room tab that contains your vendor booths or patron tables.'

export const AUTO_ARRANGE_TRAFFIC_PREREQ_TOOLTIP =
  'Place at least one Entry and one Exit door on perimeter walls before Perimeter or Traffic-aware auto-arrange.'

export interface TrafficFlowDoorSnapshot {
  id: string
  role: 'entry' | 'exit'
  kind: 'door' | 'emergency_exit'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  centerX: number
  centerY: number
  wallEdge: 'top' | 'right' | 'bottom' | 'left'
}

export interface TrafficFlowPrerequisites {
  hasEntryDoor: boolean
  hasExitDoor: boolean
  entryDoors: TrafficFlowDoorSnapshot[]
  exitDoors: TrafficFlowDoorSnapshot[]
  /** True when at least one entry and one exit are snapped to perimeter walls. */
  satisfied: boolean
}

function isEntryDoor(obj: PlacedObject): obj is DoorObject {
  return obj.kind === 'door' && obj.doorType === 'entrance'
}

function isExitDoor(obj: PlacedObject): boolean {
  return (
    obj.kind === 'emergency_exit' ||
    (obj.kind === 'door' && (obj as DoorObject).doorType === 'exit')
  )
}

function nearestWallEdge(
  aabb: { x: number; y: number; width: number; height: number },
  roomW: number,
  roomH: number
): 'top' | 'right' | 'bottom' | 'left' {
  const center = {
    x: aabb.x + aabb.width / 2,
    y: aabb.y + aabb.height / 2,
  }
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

export function isStructuralAssetOnPerimeterWall(
  obj: PlacedObject,
  roomW: number,
  roomH: number,
  toleranceFt = PERIMETER_DOOR_SNAP_TOLERANCE_FT
): boolean {
  const aabb = rotatedAabb(obj)
  const edgeDist = Math.min(
    aabb.y,
    roomH - (aabb.y + aabb.height),
    aabb.x,
    roomW - (aabb.x + aabb.width)
  )
  return edgeDist <= toleranceFt
}

function snapshotDoor(
  obj: PlacedObject,
  role: 'entry' | 'exit',
  roomW: number,
  roomH: number
): TrafficFlowDoorSnapshot {
  const aabb = rotatedAabb(obj)
  return {
    id: obj.id,
    role,
    kind: obj.kind === 'emergency_exit' ? 'emergency_exit' : 'door',
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    rotation: obj.rotation ?? 0,
    centerX: aabb.x + aabb.width / 2,
    centerY: aabb.y + aabb.height / 2,
    wallEdge: nearestWallEdge(aabb, roomW, roomH),
  }
}

/**
 * Scan the active room for perimeter-snapped entry and exit fixtures.
 */
export function evaluateTrafficFlowPrerequisites(
  doc: FloorPlanDoc,
  roomId: string
): TrafficFlowPrerequisites {
  const frame = (doc.rooms ?? []).find((r) => r.id === roomId)
  if (!frame) {
    return {
      hasEntryDoor: false,
      hasExitDoor: false,
      entryDoors: [],
      exitDoors: [],
      satisfied: false,
    }
  }

  const surface = resolveRoomPlacementSurface(doc, roomId)
  const originX = surface?.minX ?? frame.originX
  const originY = surface?.minY ?? frame.originY
  const roomW = surface
    ? Math.max(1, surface.maxX - surface.minX)
    : frame.widthFt
  const roomH = surface
    ? Math.max(1, surface.maxY - surface.minY)
    : frame.lengthFt

  const inRoom = doc.objects.filter((o) => isObjectInRoom(doc, o, roomId, roomId))

  const entryDoors: TrafficFlowDoorSnapshot[] = []
  const exitDoors: TrafficFlowDoorSnapshot[] = []

  for (const obj of inRoom) {
    const local = {
      ...obj,
      x: obj.x - originX,
      y: obj.y - originY,
    } as PlacedObject
    if (!isStructuralAssetOnPerimeterWall(local, roomW, roomH)) continue

    if (isEntryDoor(local)) {
      entryDoors.push(snapshotDoor(local, 'entry', roomW, roomH))
    } else if (isExitDoor(local)) {
      exitDoors.push(snapshotDoor(local, 'exit', roomW, roomH))
    }
  }

  return {
    hasEntryDoor: entryDoors.length > 0,
    hasExitDoor: exitDoors.length > 0,
    entryDoors,
    exitDoors,
    satisfied: entryDoors.length > 0 && exitDoors.length > 0,
  }
}
