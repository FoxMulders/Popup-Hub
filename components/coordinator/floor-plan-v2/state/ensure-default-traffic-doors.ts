/**
 * Seed one movable entry door and one movable exit on each room that lacks them.
 * Mirrors grid `ensureEntranceAndExit` — entrance on the bottom wall, exit on top.
 */

import { evaluateTrafficFlowPrerequisites } from '../engine/traffic-flow-prerequisites'
import {
  defaultStructuralDoorFootprintFt,
  snapStructuralAssetToLocalPerimeter,
} from '../interactions/structural-wall-snap'
import { resolveRoomPlacementSurface } from './placement-surface'
import type { DoorObject, FloorPlanDoc, PlacedObject, RoomFrame } from './types'

function newObjectId(): string {
  return crypto.randomUUID()
}

function seedDoorOnWall(
  role: 'entry' | 'exit',
  roomW: number,
  roomH: number,
  originX: number,
  originY: number,
): PlacedObject {
  const { width, height } = defaultStructuralDoorFootprintFt()
  const localCenterX = roomW / 2
  const probe: Pick<PlacedObject, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'kind'> =
    role === 'entry'
      ? {
          kind: 'door',
          x: localCenterX - width / 2,
          y: roomH * 0.78,
          width,
          height,
          rotation: 0,
        }
      : {
          kind: 'emergency_exit',
          x: localCenterX - width / 2,
          y: roomH * 0.22,
          width,
          height,
          rotation: 0,
        }

  const snapped = snapStructuralAssetToLocalPerimeter(probe, roomW, roomH)
  const base = {
    id: newObjectId(),
    x: originX + snapped.x!,
    y: originY + snapped.y!,
    width: snapped.width!,
    height: snapped.height!,
    rotation: snapped.rotation ?? 0,
    locked: false,
  }

  if (role === 'entry') {
    return { ...base, kind: 'door', doorType: 'entrance' } as DoorObject
  }
  return { ...base, kind: 'emergency_exit', label: 'EXIT' }
}

function activeRoomFrames(frames: ReadonlyArray<RoomFrame> | undefined): RoomFrame[] {
  return (frames ?? []).filter((frame) => !frame.mergedIntoObjectId)
}

/** Add default perimeter entry/exit doors for any room missing them. */
export function ensureDefaultTrafficDoors(doc: FloorPlanDoc): FloorPlanDoc {
  const frames = activeRoomFrames(doc.rooms)
  if (frames.length === 0) return doc

  const objectRoom = { ...(doc.objectRoom ?? {}) }
  const additions: PlacedObject[] = []

  for (const frame of frames) {
    const prereq = evaluateTrafficFlowPrerequisites(doc, frame.id)
    if (prereq.satisfied) continue

    const surface = resolveRoomPlacementSurface(doc, frame.id)
    if (!surface) continue

    const roomW = Math.max(1, surface.maxX - surface.minX)
    const roomH = Math.max(1, surface.maxY - surface.minY)

    if (!prereq.hasEntryDoor) {
      const entry = seedDoorOnWall('entry', roomW, roomH, surface.minX, surface.minY)
      additions.push(entry)
      objectRoom[entry.id] = frame.id
    }
    if (!prereq.hasExitDoor) {
      const exit = seedDoorOnWall('exit', roomW, roomH, surface.minX, surface.minY)
      additions.push(exit)
      objectRoom[exit.id] = frame.id
    }
  }

  if (additions.length === 0) return doc

  return {
    ...doc,
    objects: [...doc.objects, ...additions],
    objectRoom,
  }
}
