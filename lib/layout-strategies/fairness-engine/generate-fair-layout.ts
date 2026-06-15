import { packBoothsTrafficAware } from '@/components/coordinator/floor-plan-v2/engine/AutoArrangeEngine'
import type { Rect } from '@/components/coordinator/floor-plan-v2/interactions/geometry'
import { roomBoundingBox } from '@/lib/vendor-fairness-layout/geometry/polygon'
import {
  DEFAULT_AISLE_FT,
  DEFAULT_ATTENDEE_COUNT,
  DEFAULT_CORRIDOR_WIDTH_FT,
  DEFAULT_TIME_BUDGET_MS,
} from '@/lib/vendor-fairness-layout/constants'
import type {
  BoothPlacement,
  FairLayoutScenarioOptions,
  LayoutRequest,
  LayoutResult,
  Point,
} from '../types'
import {
  simulateExposure,
  type PlacedBoothState,
} from './exposure-simulator'
import {
  buildFairnessReport,
  exposureHeatmapGrid,
} from './fairness-report'
import { evaluateFairness } from './fairness-scorer'
import { filterTrafficSeed, seedFairnessPlacements } from './fairness-seed'
import { optimizeFairnessAnnealing } from './simulated-annealing'
import {
  placementIsValid,
  sanitizePlacements,
  validateAllPlacements,
} from './placement-validator'
import { computeRouteCoverage } from './route-coverage'

const PATRON_RANDOMNESS_FT = 0.75

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

function toLayoutPlacements(
  placed: PlacedBoothState[],
  exposurePercentages: Map<string, number>
): BoothPlacement[] {
  const maxPct = Math.max(1, ...exposurePercentages.values())
  return placed.map((p) => ({
    boothId: p.booth.id,
    x: p.x,
    y: p.y,
    rotation: p.rotation,
    exposureScore: (exposurePercentages.get(p.booth.id) ?? 0) / maxPct,
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
    if (!unplaced.has(p.booth.id)) continue
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

function runTrafficFill(
  request: LayoutRequest,
  roomW: number,
  roomH: number,
  aisleFt: number,
  stepFt: number,
  obstacles: Rect[],
  seedRoute: Point[],
  boothIds: string[]
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
    seedRoute
  )
}

function finalizeLayoutResult(
  request: LayoutRequest,
  placed: PlacedBoothState[],
  unplaced: string[],
  routeCoverage: ReturnType<typeof computeRouteCoverage>,
  scenarioOptions?: FairLayoutScenarioOptions
): LayoutResult {
  const simulation = simulateExposure(routeCoverage.route, placed, {
    attendeeCount: DEFAULT_ATTENDEE_COUNT,
    randomnessFt: PATRON_RANDOMNESS_FT,
    randomSeed: scenarioOptions?.annealingSeed,
  })
  const evaluation = evaluateFairness(
    simulation.exposurePercentages,
    routeCoverage.coveragePercentage,
    routeCoverage.missedBoothIds
  )
  const report = buildFairnessReport({
    route: routeCoverage.route,
    placed,
    simulation,
    routeCoverage,
    evaluation,
    attendeeCount: DEFAULT_ATTENDEE_COUNT,
    randomnessFt: PATRON_RANDOMNESS_FT,
  })

  return {
    placements: toLayoutPlacements(placed, simulation.exposurePercentages),
    fairnessScore: evaluation.fairnessScore,
    rawFairnessScore: evaluation.rawFairnessScore,
    route: routeCoverage.route,
    unplacedBoothIds: unplaced,
    scenarioId: scenarioOptions?.scenarioId,
    scenarioLabel: scenarioOptions?.scenarioLabel,
    coveragePercentage: routeCoverage.coveragePercentage,
    exposureVariance: evaluation.exposureVariance,
    diagnostics: report.diagnostics,
    report,
    exposureHeatmap: exposureHeatmapGrid(report.diagnostics),
    layoutValid: evaluation.layoutValid,
    scoreCappedDueToRoute: evaluation.scoreCappedDueToRoute,
    scoreCapReason: evaluation.scoreCapReason,
  }
}

/**
 * Fairness-first pipeline: serpentine seed → traffic fill → 100% coverage gate → exposure annealing.
 * Scoring uses PathfindingService booth tour + patron pass-by simulation.
 */
export function generateFairLayout(
  request: LayoutRequest,
  scenarioOptions?: FairLayoutScenarioOptions
): LayoutResult {
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
      unplaced
    )

    const merged = mergeSeedResults(
      placed,
      unplaced,
      filteredTraffic.placed,
      request,
      aisleFt,
      obstacles
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
      request.booths.map((b) => b.id)
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
  const placementKeyBeforeAnneal = JSON.stringify(
    placed.map((p) => [p.booth.id, p.x, p.y, p.rotation])
  )

  if (
    preAnnealCoverage.isFullCoverage &&
    placed.length >= 2 &&
    placed.length <= 20 &&
    validateAllPlacements(placed, request.room, aisleFt, obstacles)
  ) {
    const annealingBudget =
      scenarioOptions?.annealingTimeBudgetMs ?? annealingBudgetMs(placed.length)
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
        placed = optimized.placed
      }
    }
  }

  const placementKeyAfterAnneal = JSON.stringify(
    placed.map((p) => [p.booth.id, p.x, p.y, p.rotation])
  )
  const routeCoverage =
    placementKeyBeforeAnneal === placementKeyAfterAnneal
      ? preAnnealCoverage
      : computeRouteCoverage(request, placed)

  return finalizeLayoutResult(request, placed, unplaced, routeCoverage, scenarioOptions)
}
