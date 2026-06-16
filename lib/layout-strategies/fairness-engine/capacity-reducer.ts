import type {
  LayoutCapacityReport,
  LayoutRequest,
  FairLayoutScenarioOptions,
} from '../types'
import type { PlacedBoothState } from './exposure-simulator'
import {
  boothFootprintArea,
  runFairnessPlacementPipeline,
} from './fairness-placement-pipeline'
import { computeRouteCoverage } from './route-coverage'

export interface CapacityReductionResult {
  placed: PlacedBoothState[]
  unplaced: string[]
  removedBoothIds: string[]
  maximumFairCapacity: number
  capacityReport: LayoutCapacityReport
  routeCoverage: ReturnType<typeof computeRouteCoverage>
  optimizationFailure: boolean
  algorithmLimited: boolean
}

/**
 * Find the largest subset of booths that achieves full geometric placement
 * and 100% route coverage. Only invoked after physical capacity is proven.
 */
export function reduceToMaximumFairCapacity(
  request: LayoutRequest,
  scenarioOptions?: FairLayoutScenarioOptions
): CapacityReductionResult {
  const originalBoothCount = request.booths.length
  let remaining = [...request.booths]
  const removedBoothIds: string[] = []

  for (let guard = 0; guard < originalBoothCount + 2; guard++) {
    if (remaining.length === 0) break

    const subRequest: LayoutRequest = { ...request, booths: remaining }
    const attempt = runFairnessPlacementPipeline(subRequest, scenarioOptions)

    if (
      attempt.unplaced.length === 0 &&
      attempt.routeCoverage.isFullCoverage
    ) {
      return {
        placed: attempt.placed,
        unplaced: [],
        removedBoothIds,
        maximumFairCapacity: remaining.length,
        capacityReport: {
          originalBoothCount,
          maximumFairCapacity: remaining.length,
          removedBoothIds,
          removalReason: 'physical_capacity_exceeded',
          isPartialLayout: removedBoothIds.length > 0,
        },
        routeCoverage: attempt.routeCoverage,
        optimizationFailure: attempt.optimizationFailure,
        algorithmLimited: attempt.algorithmLimited,
      }
    }

    if (attempt.unplaced.length > 0) {
      const drop = new Set(attempt.unplaced)
      for (const id of attempt.unplaced) {
        if (!removedBoothIds.includes(id)) removedBoothIds.push(id)
      }
      remaining = remaining.filter((b) => !drop.has(b.id))
      continue
    }

    // All placed geometrically but routing failed — remove largest booth and retry.
    const largest = [...remaining].sort(
      (a, b) => boothFootprintArea(b) - boothFootprintArea(a)
    )[0]
    if (!largest) break
    remaining = remaining.filter((b) => b.id !== largest.id)
    removedBoothIds.push(largest.id)
  }

  const lastAttempt =
    remaining.length > 0
      ? runFairnessPlacementPipeline(
          { ...request, booths: remaining },
          scenarioOptions
        )
      : null

  return {
    placed: lastAttempt?.placed ?? [],
    unplaced: [
      ...new Set([
        ...removedBoothIds,
        ...(lastAttempt?.unplaced ?? []),
      ]),
    ],
    removedBoothIds,
    maximumFairCapacity: lastAttempt?.placed.length ?? 0,
    capacityReport: {
      originalBoothCount,
      maximumFairCapacity: lastAttempt?.placed.length ?? 0,
      removedBoothIds,
      removalReason: 'physical_capacity_exceeded',
      isPartialLayout: removedBoothIds.length > 0,
    },
    routeCoverage:
      lastAttempt?.routeCoverage ??
      computeRouteCoverage(request, lastAttempt?.placed ?? []),
    optimizationFailure: lastAttempt?.optimizationFailure ?? false,
    algorithmLimited: lastAttempt?.algorithmLimited ?? false,
  }
}
