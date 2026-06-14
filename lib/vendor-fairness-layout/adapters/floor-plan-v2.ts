/**
 * Bridge Floor Plan v2 document model ↔ Vendor Fairness Layout Engine.
 */
import type { BoothObject, FloorPlanDoc, PlacedObject, RoomFrame } from '@/components/coordinator/floor-plan-v2/state/types'
import { frameToRing } from '@/components/coordinator/floor-plan-v2/state/placement-surface'
import type { Booth, Entrance, Exit, LayoutRequest, LayoutResult, Point } from '../types'
import { generateFairLayout } from '../index'
import type { GenerateOptions } from '../types'

function ringToBoundary(ring: ReadonlyArray<readonly [number, number]>): Point[] {
  const open = ring.length > 1 &&
    ring[0]![0] === ring[ring.length - 1]![0] &&
    ring[0]![1] === ring[ring.length - 1]![1]
    ? ring.slice(0, -1)
    : ring
  return open.map(([x, y]) => ({ x, y }))
}

export function roomFrameToBoundary(frame: RoomFrame): Point[] {
  if (frame.perimeterRing && frame.perimeterRing.length >= 3) {
    return ringToBoundary(frame.perimeterRing)
  }
  return ringToBoundary(frameToRing(frame))
}

export function findEntranceExit(
  doc: FloorPlanDoc,
  roomId?: string
): { entrance: Entrance; exit: Exit } | null {
  const doors = doc.objects.filter((o): o is PlacedObject & { kind: 'door' } => o.kind === 'door')
  const entranceDoor = doors.find((d) => d.doorType === 'entrance') ?? doors[0]
  const exitDoor =
    doors.find((d) => d.doorType === 'exit') ??
    doc.objects.find((o) => o.kind === 'emergency_exit') ??
    doors[1]

  if (!entranceDoor) return null

  const entrance: Entrance = {
    x: entranceDoor.x + entranceDoor.width / 2,
    y: entranceDoor.y + entranceDoor.height / 2,
  }
  const exit: Exit = exitDoor
    ? { x: exitDoor.x + exitDoor.width / 2, y: exitDoor.y + exitDoor.height / 2 }
    : { x: entrance.x + 20, y: entrance.y }

  void roomId
  return { entrance, exit }
}

export function vendorBoothsFromDoc(doc: FloorPlanDoc): Booth[] {
  return doc.objects
    .filter((o): o is BoothObject => o.kind === 'booth')
    .map((b) => ({ id: b.id, width: b.width, height: b.height }))
}

export function layoutRequestFromFloorPlan(
  doc: FloorPlanDoc,
  roomFrame: RoomFrame
): LayoutRequest | null {
  const terminals = findEntranceExit(doc, roomFrame.id)
  if (!terminals) return null

  const booths = doc.objects
    .filter((o): o is BoothObject => o.kind === 'booth')
    .map((b) => ({ id: b.id, width: b.width, height: b.height }))

  if (booths.length === 0) return null

  return {
    room: { boundary: roomFrameToBoundary(roomFrame) },
    booths,
    entrance: terminals.entrance,
    exit: terminals.exit,
  }
}

export function applyLayoutResultToBooths(
  doc: FloorPlanDoc,
  result: LayoutResult
): BoothObject[] {
  const byId = new Map(result.placements.map((p) => [p.boothId, p]))
  return doc.objects
    .filter((o): o is BoothObject => o.kind === 'booth')
    .map((b) => {
      const p = byId.get(b.id)
      if (!p) return b
      return { ...b, x: p.x, y: p.y, rotation: p.rotation }
    })
}

export function generateFairLayoutFromDoc(
  doc: FloorPlanDoc,
  roomFrame: RoomFrame,
  options?: GenerateOptions
): LayoutResult | null {
  const request = layoutRequestFromFloorPlan(doc, roomFrame)
  if (!request) return null
  return generateFairLayout(request, options)
}
