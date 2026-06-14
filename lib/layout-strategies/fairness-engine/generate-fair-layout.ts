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
import { filterTrafficSeed, seedFairnessPlacements } from './fairness-seed'
import { computeFairnessScore } from './fairness-scorer'
import { optimizeFairnessAnnealing } from './simulated-annealing'
import {
  placementIsValid,
  sanitizePlacements,
  validateAllPlacements,
} from './placement-validator'

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

function mergeSeedResults(
  snake: PlacedBoothState[],
  snakeUnplaced: string[],
  extra: PlacedBoothState[],
  request: LayoutRequest,
  aisleFt: number,
  obstacles: Rect[]
): { placed: PlacedBoothState[]; unplaced: string[] } {
  const placed = [...snake]
  const placedIds = new Set(placed.map((p) => p.booth.id))
  const unplaced = new Set(snakeUnplaced)

  for (const p of extra) {
    if (placedIds.has(p.booth.id)) continue
    if (
      placementIsValid(
        p.x,
        p.y,
        p.booth,
        p.rotation,
        request.room,
        aisleFt,
        obstacles,
        placed
      )
    ) {
      placed.push(p)
      placedIds.add(p.booth.id)
      unplaced.delete(p.booth.id)
    }
  }

  for (const b of request.booths) {
    if (!placedIds.has(b.id) && !unplaced.has(b.id)) {
      unplaced.add(b.id)
    }
  }

  return { placed, unplaced: [...unplaced] }
}

/**
 * Fairness-first pipeline: polygon snake seed → optional traffic fill → exposure annealing.
 */
export function generateFairLayout(request: LayoutRequest): LayoutResult {
  const { roomW, roomH } = resolveRoomSize(request)
  const aisleFt = request.aisleFt ?? DEFAULT_AISLE_FT
  const stepFt = request.stepFt ?? 0.5
  const obstacles = obstaclesToRects(request)

  const snakeSeed = seedFairnessPlacements(request, {
    aisleFt,
    stepFt,
    corridorWidthFt: DEFAULT_CORRIDOR_WIDTH_FT,
    obstacles,
  })
  let route = snakeSeed.route

  const trafficSeed = packBoothsTrafficAware(
    roomW,
    roomH,
    request.booths.map((b) => ({ id: b.id, width: b.width, height: b.height })),
    {
      entrance: request.entrance,
      exit: request.exit,
      obstacles,
      aisleWidth: aisleFt,
      stepFt,
      eventCategoryNames: request.eventCategoryNames,
    }
  )

  const filteredTraffic = filterTrafficSeed(
    trafficSeed.placed,
    request.booths,
    request,
    aisleFt,
    obstacles
  )

  let { placed, unplaced } = mergeSeedResults(
    snakeSeed.placed,
    snakeSeed.unplaced,
    filteredTraffic.placed,
    request,
    aisleFt,
    obstacles
  )

  if (placed.length === 0 && filteredTraffic.placed.length > 0) {
    placed = filteredTraffic.placed
    unplaced = filteredTraffic.unplaced
  }

  if (placed.length >= 2 && validateAllPlacements(placed, request.room, aisleFt, obstacles)) {
    const optimized = optimizeFairnessAnnealing(placed, route, request.room, {
      aisleFt,
      stepFt,
      obstacles,
      timeBudgetMs: DEFAULT_TIME_BUDGET_MS,
    })
    if (
      optimized.placed.length > 0 &&
      validateAllPlacements(optimized.placed, request.room, aisleFt, obstacles)
    ) {
      placed = optimized.placed
    }
  }

  const sanitized = sanitizePlacements(placed, request.room, aisleFt, obstacles)
  placed = sanitized.valid
  unplaced = [
    ...new Set([...unplaced, ...sanitized.droppedIds]),
  ].filter((id) => !placed.some((p) => p.booth.id === id))

  const scores = exposureScoresFromPlacements(route, placed)
  let fairnessScore = computeFairnessScore(scores)
  if (placed.length > 0 && fairnessScore === 0) {
    const mean = [...scores.values()].reduce((a, b) => a + b, 0) / scores.size
    fairnessScore = mean > 0 ? Math.max(1, Math.round(mean * 100)) : 1
  }

  return {
    placements: toLayoutPlacements(placed, route),
    fairnessScore,
    route: trafficSeed.meta?.pathway ?? route,
    unplacedBoothIds: unplaced,
  }
}
