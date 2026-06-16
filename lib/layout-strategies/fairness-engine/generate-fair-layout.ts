import { DEFAULT_ATTENDEE_COUNT } from '@/lib/vendor-fairness-layout/constants'
import type {
  BoothPlacement,
  FairLayoutScenarioOptions,
  LayoutCapacityReport,
  LayoutOutcomeReason,
  LayoutRequest,
  LayoutResult,
} from '../types'
import { reduceToMaximumFairCapacity } from './capacity-reducer'
import {
  simulateExposure,
  type PlacedBoothState,
} from './exposure-simulator'
import {
  buildFairnessReport,
  exposureHeatmapGrid,
} from './fairness-report'
import { buildLayoutScores, evaluateFairness } from './fairness-scorer'
import { runFairnessPlacementPipeline } from './fairness-placement-pipeline'
import {
  classifyLayoutOutcome,
  isCompleteOutcome,
} from './layout-outcome'
import type { RouteCoverageResult } from './route-coverage'

const PATRON_RANDOMNESS_FT = 0.75

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

function finalizeLayoutResult(input: {
  request: LayoutRequest
  placed: PlacedBoothState[]
  unplaced: string[]
  routeCoverage: RouteCoverageResult
  scenarioOptions?: FairLayoutScenarioOptions
  outcomeReason: LayoutOutcomeReason
  capacityReport: LayoutCapacityReport
}): LayoutResult {
  const {
    request,
    placed,
    unplaced,
    routeCoverage,
    scenarioOptions,
    outcomeReason,
    capacityReport,
  } = input

  const simulation = simulateExposure(routeCoverage.route, placed, {
    attendeeCount: DEFAULT_ATTENDEE_COUNT,
    randomnessFt: PATRON_RANDOMNESS_FT,
    randomSeed: scenarioOptions?.annealingSeed,
  })
  const scores = buildLayoutScores({
    originalBoothCount: request.booths.length,
    maximumFairCapacity: capacityReport.maximumFairCapacity,
    coveragePercentage: routeCoverage.coveragePercentage,
    boothExposures: simulation.exposurePercentages,
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
    scores,
    outcomeReason,
    capacityReport,
  })

  return {
    placements: toLayoutPlacements(placed, simulation.exposurePercentages),
    fairnessScore: scores.fairnessScore,
    rawFairnessScore: evaluation.rawFairnessScore,
    route: routeCoverage.route,
    unplacedBoothIds: unplaced,
    scenarioId: scenarioOptions?.scenarioId,
    scenarioLabel: scenarioOptions?.scenarioLabel,
    coveragePercentage: scores.coverageScore,
    exposureVariance: evaluation.exposureVariance,
    diagnostics: report.diagnostics,
    report,
    exposureHeatmap: exposureHeatmapGrid(report.diagnostics),
    layoutValid: isCompleteOutcome(outcomeReason),
    scoreCappedDueToRoute: evaluation.scoreCappedDueToRoute,
    scoreCapReason: evaluation.scoreCapReason,
    scores,
    outcomeReason,
    capacityReport,
  }
}

/**
 * Fairness-first pipeline: serpentine seed → traffic fill → optional anneal → classify outcome.
 * Booth removal runs only after physical capacity is proven (never for routing failure).
 */
export function generateFairLayout(
  request: LayoutRequest,
  scenarioOptions?: FairLayoutScenarioOptions
): LayoutResult {
  const originalBoothCount = request.booths.length
  let pipeline = runFairnessPlacementPipeline(request, scenarioOptions)

  let capacityReport: LayoutCapacityReport = {
    originalBoothCount,
    maximumFairCapacity: pipeline.placed.length,
    removedBoothIds: [],
    removalReason: null,
    isPartialLayout: false,
  }

  let outcomeReason = classifyLayoutOutcome({
    originalBoothCount,
    placedCount: pipeline.placed.length,
    unplacedIds: pipeline.unplaced,
    routeCoverage: pipeline.routeCoverage,
    optimizationFailure: pipeline.optimizationFailure,
    algorithmLimited: pipeline.algorithmLimited,
    removedForCapacity: false,
  })

  if (outcomeReason === 'physical_capacity_exceeded') {
    const reduced = reduceToMaximumFairCapacity(request, scenarioOptions)
    pipeline = {
      placed: reduced.placed,
      unplaced: reduced.unplaced,
      routeCoverage: reduced.routeCoverage,
      optimizationFailure: reduced.optimizationFailure,
      algorithmLimited: reduced.algorithmLimited,
    }
    capacityReport = reduced.capacityReport
    outcomeReason = classifyLayoutOutcome({
      originalBoothCount,
      placedCount: pipeline.placed.length,
      unplacedIds: pipeline.unplaced,
      routeCoverage: pipeline.routeCoverage,
      optimizationFailure: pipeline.optimizationFailure,
      algorithmLimited: pipeline.algorithmLimited,
      removedForCapacity: reduced.removedBoothIds.length > 0,
    })
  }

  const maximumFairCapacity = Math.max(
    capacityReport.maximumFairCapacity,
    pipeline.placed.length
  )

  return finalizeLayoutResult({
    request,
    placed: pipeline.placed,
    unplaced: pipeline.unplaced,
    routeCoverage: pipeline.routeCoverage,
    scenarioOptions,
    outcomeReason,
    capacityReport: {
      ...capacityReport,
      maximumFairCapacity,
    },
  })
}
