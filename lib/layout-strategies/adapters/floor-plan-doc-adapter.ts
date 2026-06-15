import { evaluateTrafficFlowPrerequisites } from '@/components/coordinator/floor-plan-v2/engine/traffic-flow-prerequisites'
import {
  applyPlacementsToBooths,
  restrictedObstaclesInRoom,
} from '@/components/coordinator/floor-plan-v2/engine/AutoArrangeEngine'
import { resolveRoomPlacementSurface } from '@/components/coordinator/floor-plan-v2/state/placement-surface'
import type { BoothObject, FloorPlanDoc } from '@/components/coordinator/floor-plan-v2/state/types'
import { parseLayoutMode } from '../LayoutMode'
import type { LayoutRequest, LayoutResult, Point } from '../types'
import { buildPathfindingDocFromLayout } from '../fairness-engine/route-coverage'

function ringToBoundary(
  ring: ReadonlyArray<readonly [number, number]>,
  originX: number,
  originY: number
): Point[] {
  return ring.map(([x, y]) => ({ x: x - originX, y: y - originY }))
}

/** Build a room-local {@link LayoutRequest} from a floor-plan doc slice. */
export function layoutRequestFromDocRoom(
  doc: FloorPlanDoc,
  roomId: string,
  booths: ReadonlyArray<{ id: string; width: number; height: number }>,
  options: {
    vendorLayoutMode?: string | null
    eventCategoryNames?: ReadonlyArray<string>
    aisleFt?: number
    stepFt?: number
  } = {}
): LayoutRequest | null {
  const surface = resolveRoomPlacementSurface(doc, roomId)
  if (!surface || surface.outerRings.length === 0) return null

  const originX = surface.minX
  const originY = surface.minY
  const roomW = Math.max(1, surface.maxX - surface.minX)
  const roomH = Math.max(1, surface.maxY - surface.minY)
  const boundary = ringToBoundary(surface.outerRings[0]!, originX, originY)

  const traffic = evaluateTrafficFlowPrerequisites(doc, roomId)
  const entranceLocal = traffic.entryDoors[0]
    ? {
        x: traffic.entryDoors[0].centerX - originX,
        y: traffic.entryDoors[0].centerY - originY,
      }
    : { x: roomW / 2, y: roomH - 4 }
  const exitLocal = traffic.exitDoors[0]
    ? {
        x: traffic.exitDoors[0].centerX - originX,
        y: traffic.exitDoors[0].centerY - originY,
      }
    : { x: roomW / 2, y: 4 }

  const obstacles = restrictedObstaclesInRoom(doc, roomId).map((o) => ({
    ...o,
    x: o.x - originX,
    y: o.y - originY,
  }))

  void parseLayoutMode(options.vendorLayoutMode ?? doc.vendorLayoutMode)

  return {
    room: { boundary },
    booths: booths.map((b) => ({ ...b })),
    entrance: entranceLocal,
    exit: exitLocal,
    obstacles,
    roomWidthFt: roomW,
    roomHeightFt: roomH,
    aisleFt: options.aisleFt,
    stepFt: options.stepFt ?? doc.snapFt ?? 0.5,
    eventCategoryNames: options.eventCategoryNames,
  }
}

export interface ApplyLayoutResultOptions {
  originX: number
  originY: number
}

/** Apply strategy placements onto booth objects (global canvas coords). */
export function applyLayoutResultToBooths(
  booths: BoothObject[],
  result: LayoutResult,
  options: ApplyLayoutResultOptions
): BoothObject[] {
  const packResult = {
    placed: result.placements.map((p) => ({
      id: p.boothId,
      x: p.x + options.originX,
      y: p.y + options.originY,
      rotation: p.rotation,
    })),
    unplaced: result.unplacedBoothIds ?? [],
  }
  return applyPlacementsToBooths(booths, packResult)
}

export function layoutResultMeta(result: LayoutResult): {
  fairnessScore: number
  coveragePercentage: number | undefined
  layoutValid: boolean | undefined
  routeGlobal: (origin: { x: number; y: number }) => Point[]
} {
  return {
    fairnessScore: result.fairnessScore,
    coveragePercentage: result.coveragePercentage,
    layoutValid: result.layoutValid,
    routeGlobal: (origin) =>
      result.route.map((p) => ({ x: p.x + origin.x, y: p.y + origin.y })),
  }
}

/** Build a PathfindingService-ready doc from a layout request + placements. */
export function pathfindingDocFromLayoutRequest(
  request: LayoutRequest,
  placements: LayoutResult['placements'],
  options: { snapFt?: number } = {}
) {
  const placed = placements.map((p) => {
    const booth = request.booths.find((b) => b.id === p.boothId)
    if (!booth) throw new Error(`Unknown booth ${p.boothId}`)
    return { booth, x: p.x, y: p.y, rotation: p.rotation }
  })
  return buildPathfindingDocFromLayout(request, placed, options)
}
