import { packBoothsTrafficAware } from '@/components/coordinator/floor-plan-v2/engine/AutoArrangeEngine'
import type { Rect } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import { roomBoundingBox } from '@/lib/vendor-fairness-layout/geometry/polygon'
import {
  DEFAULT_AISLE_FT,
  DEFAULT_CORRIDOR_WIDTH_FT,
  DEFAULT_TIME_BUDGET_MS,
} from '@/lib/vendor-fairness-layout/constants'
import type { BoothPlacement, LayoutRequest, LayoutResult, Point } from '../types'
import {
  exposureScoresFromPlacements,
  type PlacedBoothState,
} from './exposure-simulator'
import { computeFairnessScore } from './fairness-scorer'
import { buildSnakeCirculation } from './snake-circulation'
import {
  optimizeFairnessAnnealing,
  seedPlacementsFromTraffic,
} from './simulated-annealing'

function resolveRoomSize(request: LayoutRequest): {
  roomW: number
  roomH: number
} {
  const bbox = roomBoundingBox(request.room.boundary)
  return {
    roomW: request.roomWidthFt ?? bbox.width,
    roomH: request.roomHeightFt ?? bbox.height,
  }
}

function obstaclesToRects(
  request: LayoutRequest
): Rect[] {
  return (request.obstacles ?? []).map((o) => ({
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
  }))
}

function toLayoutPlacements(
  placed: PlacedBoothState[],
  route: Point[]
): BoothPlacement[] {
  const scores = exposureScoresFromPlacements(route, placed)
  return placed.map((p) => ({
    boothId: p.booth.id,
    x: p.x,
    y: p.y,
    rotation: p.rotation,
    exposureScore: scores.get(p.booth.id) ?? 0,
  }))
}

/**
 * Fairness-first pipeline: traffic-aware seed → snake route → exposure sim → annealing.
 */
export function generateFairLayout(request: LayoutRequest): LayoutResult {
  const { roomW, roomH } = resolveRoomSize(request)
  const aisleFt = request.aisleFt ?? DEFAULT_AISLE_FT
  const stepFt = request.stepFt ?? 0.5
  const obstacles = obstaclesToRects(request)

  const entrance: Point = { ...request.entrance }
  const exit: Point = { ...request.exit }

  const maxDepth = Math.max(...request.booths.map((b) => b.height), 6)
  const route = buildSnakeCirculation(
    roomW,
    roomH,
    entrance,
    exit,
    DEFAULT_CORRIDOR_WIDTH_FT,
    maxDepth
  )

  const trafficSeed = packBoothsTrafficAware(
    roomW,
    roomH,
    request.booths.map((b) => ({ id: b.id, width: b.width, height: b.height })),
    {
      entrance,
      exit,
      obstacles,
      aisleWidth: aisleFt,
      stepFt,
      eventCategoryNames: request.eventCategoryNames,
    }
  )

  let placed = seedPlacementsFromTraffic(trafficSeed.placed, request.booths)

  if (placed.length >= 2) {
    const optimized = optimizeFairnessAnnealing(placed, route, request.room, {
      aisleFt,
      stepFt,
      obstacles,
      timeBudgetMs: DEFAULT_TIME_BUDGET_MS,
    })
    placed = optimized.placed
  }

  const scores = exposureScoresFromPlacements(route, placed)
  const fairnessScore = computeFairnessScore(scores)

  return {
    placements: toLayoutPlacements(placed, route),
    fairnessScore,
    route: trafficSeed.meta?.pathway ?? route,
    unplacedBoothIds: trafficSeed.unplaced,
  }
}
