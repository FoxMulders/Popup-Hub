/**
 * Bridge LayoutRequest placements → PathfindingService booth tour + coverage %.
 */

import {
  CalculateOptimalPath,
  type PathPoint,
} from '@/components/coordinator/floor-plan-v2/engine/PathfindingService'
import type { PlacementRing } from '@/components/coordinator/floor-plan-v2/state/placement-surface'
import type {
  BoothObject,
  FloorPlanDoc,
  PlacedObject,
} from '@/components/coordinator/floor-plan-v2/state/types'
import { roomBoundingBox } from '@/lib/vendor-fairness-layout/geometry/polygon'
import type { LayoutRequest, Point } from '../types'
import type { PlacedBoothState } from './exposure-simulator'

export const FAIRNESS_PATHFIND_ROOM_ID = '__fairness_layout_room__'

const DOOR_SIZE_FT = 2

export interface RouteCoverageResult {
  route: Point[]
  /** 0–100 — boothsPassedByRoute / totalBooths × 100. */
  coveragePercentage: number
  boothsPassedByRoute: number
  totalBooths: number
  missedBoothIds: string[]
  visitedBoothIds: string[]
  isFullCoverage: boolean
  missingDoors: boolean
  pathfindingFailed: boolean
}

function closeRing(boundary: Point[]): PlacementRing {
  if (boundary.length === 0) return []
  const open: Array<readonly [number, number]> = boundary.map(
    (p) => [p.x, p.y] as const
  )
  const first = open[0]!
  const last = open[open.length - 1]!
  if (first[0] !== last[0] || first[1] !== last[1]) {
    open.push([first[0], first[1]])
  }
  return open
}

function doorObject(
  id: string,
  center: Point,
  doorType: 'entrance' | 'exit'
): PlacedObject {
  return {
    id,
    kind: 'door',
    doorType,
    x: center.x - DOOR_SIZE_FT / 2,
    y: center.y - DOOR_SIZE_FT / 2,
    width: DOOR_SIZE_FT,
    height: DOOR_SIZE_FT,
    rotation: 0,
  }
}

function boothObject(state: PlacedBoothState): BoothObject {
  return {
    id: state.booth.id,
    kind: 'booth',
    x: state.x,
    y: state.y,
    width: state.booth.width,
    height: state.booth.height,
    rotation: state.rotation,
  }
}

function obstacleObject(
  id: string,
  o: { x: number; y: number; width: number; height: number; rotation?: number }
): PlacedObject {
  return {
    id,
    kind: 'wall',
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
    rotation: o.rotation ?? 0,
  }
}

/** Minimal FloorPlanDoc for PathfindingService from a layout-strategy request. */
export function buildPathfindingDocFromLayout(
  request: LayoutRequest,
  placed: PlacedBoothState[],
  options: { snapFt?: number } = {}
): {
  doc: FloorPlanDoc
  roomId: string
  roomBoundary: PlacementRing[]
  booths: BoothObject[]
} {
  const bbox = roomBoundingBox(request.room.boundary)
  const roomW = request.roomWidthFt ?? bbox.width
  const roomH = request.roomHeightFt ?? bbox.height
  const roomBoundary = [closeRing(request.room.boundary)]
  const roomId = FAIRNESS_PATHFIND_ROOM_ID

  const objects: PlacedObject[] = [
    doorObject('__entry_door__', request.entrance, 'entrance'),
    doorObject('__exit_door__', request.exit, 'exit'),
    ...placed.map(boothObject),
    ...(request.obstacles ?? []).map((o, i) =>
      obstacleObject(`__obstacle_${i}__`, o)
    ),
  ]

  const objectRoom: Record<string, string> = {}
  for (const obj of objects) {
    objectRoom[obj.id] = roomId
  }

  const doc: FloorPlanDoc = {
    canvasWidthFt: Math.max(roomW, bbox.x + bbox.width),
    canvasLengthFt: Math.max(roomH, bbox.y + bbox.height),
    gridSpacingFt: 1,
    snapFt: options.snapFt ?? request.stepFt ?? 1,
    objects,
    rooms: [
      {
        id: roomId,
        name: 'Fairness layout',
        originX: 0,
        originY: 0,
        widthFt: roomW,
        lengthFt: roomH,
        perimeterRing: roomBoundary[0],
      },
    ],
    objectRoom,
  }

  return {
    doc,
    roomId,
    roomBoundary,
    booths: placed.map(boothObject),
  }
}

function pathPointsToRoute(path: PathPoint[]): Point[] {
  return path.map((p) => ({ x: p.x, y: p.y }))
}

/**
 * Compute patron tour via PathfindingService and derive booth coverage.
 * `coveragePercentage = boothsPassedByRoute / totalBooths × 100`.
 */
export function computeRouteCoverage(
  request: LayoutRequest,
  placed: PlacedBoothState[],
  options: { cellFt?: number; obstacleBufferFt?: number } = {}
): RouteCoverageResult {
  const totalBooths = placed.length
  const empty: RouteCoverageResult = {
    route: [],
    coveragePercentage: 0,
    boothsPassedByRoute: 0,
    totalBooths,
    missedBoothIds: placed.map((p) => p.booth.id),
    visitedBoothIds: [],
    isFullCoverage: false,
    missingDoors: false,
    pathfindingFailed: true,
  }

  if (totalBooths === 0) {
    return {
      ...empty,
      pathfindingFailed: false,
      missedBoothIds: [],
      isFullCoverage: true,
      coveragePercentage: 100,
    }
  }

  const cellFt =
    options.cellFt ??
    (placed.length > 12 ? 1 : placed.length > 8 ? 0.75 : request.stepFt ?? 0.5)

  const { doc, roomId, roomBoundary, booths } = buildPathfindingDocFromLayout(
    request,
    placed,
    { snapFt: cellFt }
  )

  const result = CalculateOptimalPath(doc, roomId, {
    cellFt,
    obstacleBufferFt: options.obstacleBufferFt,
    booths,
    roomBoundary,
  })

  if (!result) {
    return empty
  }

  if (result.missingDoors) {
    return {
      ...empty,
      missingDoors: true,
      pathfindingFailed: false,
    }
  }

  const visitedBoothIds = result.visitedBoothIds ?? result.visitOrder ?? []
  const missedBoothIds =
    result.missedBoothIds ??
    placed
      .map((p) => p.booth.id)
      .filter((id) => !visitedBoothIds.includes(id))

  const boothsPassedByRoute = totalBooths - missedBoothIds.length
  const coveragePercentage =
    totalBooths > 0 ? (boothsPassedByRoute / totalBooths) * 100 : 100

  return {
    route: pathPointsToRoute(result.path),
    coveragePercentage,
    boothsPassedByRoute,
    totalBooths,
    missedBoothIds,
    visitedBoothIds,
    isFullCoverage: missedBoothIds.length === 0 && result.path.length >= 2,
    missingDoors: false,
    pathfindingFailed: result.path.length < 2,
  }
}

export function hasFullRouteCoverage(coverage: RouteCoverageResult): boolean {
  return coverage.isFullCoverage
}
