import { packBoothsTrafficAware } from '@/components/coordinator/floor-plan-v2/engine/AutoArrangeEngine'
import type { Rect } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import { roomBoundingBox } from '@/lib/vendor-fairness-layout/geometry/polygon'
import {
  DEFAULT_AISLE_FT,
  DEFAULT_CORRIDOR_WIDTH_FT,
  DEFAULT_TIME_BUDGET_MS,
} from '@/lib/vendor-fairness-layout/constants'
import type { FairLayoutScenarioOptions, LayoutRequest, Point } from '../types'
import { tryPlaceWithFullCoverage } from './coverage-aware-placement'
import type { PlacedBoothState } from './exposure-simulator'
import { filterTrafficSeed, seedFairnessPlacements } from './fairness-seed'
import {
  sanitizePlacements,
  validateAllPlacements,
} from './placement-validator'
import { computeRouteCoverage, type RouteCoverageResult } from './route-coverage'
import { optimizeFairnessAnnealing } from './simulated-annealing'

export interface PlacementPipelineResult {
  placed: PlacedBoothState[]
  unplaced: string[]
  routeCoverage: RouteCoverageResult
  optimizationFailure: boolean
  algorithmLimited: boolean
}

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

function obstaclesToRects(request: LayoutRequest): Rect[] {
  return (request.obstacles ?? []).map((o) => ({
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
  }))
}

function annealingBudgetMs(boothCount: number): number {
  if (boothCount > 20) return 0
  return Math.min(
    12_000,
    DEFAULT_TIME_BUDGET_MS + Math.max(0, boothCount - 6) * 120
  )
}

function mergeSeedResults(
  snake: PlacedBoothState[],
  snakeUnplaced: string[],
  extra: PlacedBoothState[],
  request: LayoutRequest,
  aisleFt: number,
  obstacles: Rect[],
  seedRoute: Point[]
): { placed: PlacedBoothState[]; unplaced: string[] } {
  const placed = [...snake]
  const placedIds = new Set(placed.map((p) => p.booth.id))
  const unplaced = new Set(snakeUnplaced)

  for (const p of extra) {
    if (placedIds.has(p.booth.id)) continue
    if (!unplaced.has(p.booth.id)) continue
    const accepted = tryPlaceWithFullCoverage(
      p.booth,
      [{ x: p.x, y: p.y, rotation: p.rotation }],
      request,
      seedRoute,
      aisleFt,
      obstacles,
      placed
    )
    if (accepted) {
      placed.push(accepted)
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

function runTrafficFill(
  request: LayoutRequest,
  roomW: number,
  roomH: number,
  aisleFt: number,
  stepFt: number,
  obstacles: Rect[],
  seedRoute: Point[],
  boothIds: string[],
  existingPlaced: PlacedBoothState[] = []
): { placed: PlacedBoothState[]; unplaced: string[] } {
  if (boothIds.length === 0) {
    return { placed: [], unplaced: [] }
  }

  const trafficSeed = packBoothsTrafficAware(
    roomW,
    roomH,
    request.booths
      .filter((b) => boothIds.includes(b.id))
      .map((b) => ({ id: b.id, width: b.width, height: b.height })),
    {
      entrance: request.entrance,
      exit: request.exit,
      obstacles,
      aisleWidth: aisleFt,
      stepFt,
      eventCategoryNames: request.eventCategoryNames,
    }
  )

  return filterTrafficSeed(
    trafficSeed.placed,
    request.booths,
    request,
    aisleFt,
    obstacles,
    seedRoute,
    existingPlaced
  )
}

/** Seed → traffic → sanitize → optional anneal (reverts on optimization failure). No routing prune. */
export function runFairnessPlacementPipeline(
  request: LayoutRequest,
  scenarioOptions?: FairLayoutScenarioOptions
): PlacementPipelineResult {
  const { roomW, roomH } = resolveRoomSize(request)
  const aisleFt = request.aisleFt ?? DEFAULT_AISLE_FT
  const stepFt = request.stepFt ?? 0.5
  const obstacles = obstaclesToRects(request)
  const skipTraffic = scenarioOptions?.skipTrafficSeed ?? false

  const snakeSeed = seedFairnessPlacements(request, {
    aisleFt,
    stepFt,
    corridorWidthFt: DEFAULT_CORRIDOR_WIDTH_FT,
    obstacles,
    primaryAxis: scenarioOptions?.primaryAxis,
    reverseFlow: scenarioOptions?.reverseFlow,
    aisleSideBias: scenarioOptions?.aisleSideBias,
  })
  const seedRoute = snakeSeed.route

  let { placed, unplaced } = snakeSeed

  if (!skipTraffic && unplaced.length > 0) {
    const filteredTraffic = runTrafficFill(
      request,
      roomW,
      roomH,
      aisleFt,
      stepFt,
      obstacles,
      seedRoute,
      unplaced,
      placed
    )
    const merged = mergeSeedResults(
      placed,
      unplaced,
      filteredTraffic.placed,
      request,
      aisleFt,
      obstacles,
      seedRoute
    )
    placed = merged.placed
    unplaced = merged.unplaced
  }

  if (!skipTraffic && placed.length === 0) {
    const filteredTraffic = runTrafficFill(
      request,
      roomW,
      roomH,
      aisleFt,
      stepFt,
      obstacles,
      seedRoute,
      request.booths.map((b) => b.id),
      []
    )
    placed = filteredTraffic.placed
    unplaced = filteredTraffic.unplaced
  }

  const sanitized = sanitizePlacements(placed, request.room, aisleFt, obstacles)
  placed = sanitized.valid
  unplaced = [
    ...new Set([...unplaced, ...sanitized.droppedIds]),
  ].filter((id) => !placed.some((p) => p.booth.id === id))

  const preAnnealCoverage = computeRouteCoverage(request, placed)
  const preAnnealPlaced = placed.map((p) => ({
    ...p,
    booth: { ...p.booth },
  }))
  let optimizationFailure = false
  let algorithmLimited = false

  const annealingBudget =
    scenarioOptions?.annealingTimeBudgetMs ?? annealingBudgetMs(placed.length)

  if (
    preAnnealCoverage.isFullCoverage &&
    placed.length >= 2 &&
    placed.length <= 20 &&
    validateAllPlacements(placed, request.room, aisleFt, obstacles)
  ) {
    if (annealingBudget > 0) {
      const optimized = optimizeFairnessAnnealing(placed, request, request.room, {
        aisleFt,
        stepFt,
        obstacles,
        timeBudgetMs: annealingBudget,
        randomSeed: scenarioOptions?.annealingSeed,
      })
      if (
        optimized.placed.length > 0 &&
        validateAllPlacements(optimized.placed, request.room, aisleFt, obstacles)
      ) {
        const postAnnealCoverage = computeRouteCoverage(request, optimized.placed)
        if (postAnnealCoverage.isFullCoverage) {
          placed = optimized.placed
        } else {
          optimizationFailure = true
          placed = preAnnealPlaced
        }
      }
    }
  } else if (
    preAnnealCoverage.isFullCoverage &&
    placed.length >= 2 &&
    annealingBudget <= 0
  ) {
    algorithmLimited = true
  }

  const routeCoverage = computeRouteCoverage(request, placed)

  return {
    placed,
    unplaced,
    routeCoverage,
    optimizationFailure,
    algorithmLimited,
  }
}

export function boothFootprintArea(booth: { width: number; height: number }): number {
  return booth.width * booth.height
}
