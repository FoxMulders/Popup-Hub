import type { LayoutOutcomeReason } from '../types'
import type { RouteCoverageResult } from './route-coverage'

export interface OutcomeClassificationInput {
  originalBoothCount: number
  placedCount: number
  unplacedIds: string[]
  routeCoverage: RouteCoverageResult
  optimizationFailure: boolean
  algorithmLimited: boolean
  removedForCapacity: boolean
}

export function classifyLayoutOutcome(
  input: OutcomeClassificationInput
): LayoutOutcomeReason {
  if (input.removedForCapacity) {
    return 'physical_capacity_exceeded'
  }
  if (input.algorithmLimited) {
    return 'algorithm_limitation'
  }
  if (input.optimizationFailure) {
    return 'optimization_failure'
  }

  const allPlaced =
    input.unplacedIds.length === 0 &&
    input.placedCount === input.originalBoothCount

  if (allPlaced && input.routeCoverage.isFullCoverage) {
    return 'complete'
  }
  if (!allPlaced) {
    return 'physical_capacity_exceeded'
  }
  return 'routing_failure'
}

export function isCompleteOutcome(reason: LayoutOutcomeReason): boolean {
  return reason === 'complete'
}
