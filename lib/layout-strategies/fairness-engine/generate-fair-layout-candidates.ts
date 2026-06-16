import { nextAnimationFrame } from '@/lib/booth-planner/placement-guard'
import type {
  FairLayoutCandidatesOptions,
  LayoutRequest,
  LayoutResult,
} from '../types'
import {
  DEFAULT_MULTI_SCENARIO_BUDGET_MS,
  fairLayoutScenarioConfigsForRequest,
} from './fair-layout-scenarios'
import { generateFairLayout } from './generate-fair-layout'

function isFullRosterComplete(candidate: LayoutResult): boolean {
  return (
    candidate.outcomeReason === 'complete' &&
    candidate.capacityReport?.isPartialLayout !== true &&
    (candidate.scores?.capacityScore ?? 100) >= 100 - 1e-6
  )
}

function rankCandidates(candidates: LayoutResult[]): LayoutResult[] {
  return [...candidates].sort((a, b) => {
    const fullA = isFullRosterComplete(a)
    const fullB = isFullRosterComplete(b)
    if (fullA !== fullB) {
      return Number(fullB) - Number(fullA)
    }

    const capA = a.scores?.capacityScore ?? (fullA ? 100 : 0)
    const capB = b.scores?.capacityScore ?? (fullB ? 100 : 0)
    if (capA !== capB) return capB - capA

    const covA = a.scores?.coverageScore ?? a.coveragePercentage ?? 0
    const covB = b.scores?.coverageScore ?? b.coveragePercentage ?? 0
    if (covA !== covB) return covB - covA

    if (b.fairnessScore !== a.fairnessScore) {
      return b.fairnessScore - a.fairnessScore
    }

    const varA = a.exposureVariance ?? Infinity
    const varB = b.exposureVariance ?? Infinity
    if (Math.abs(varA - varB) > 1e-6) return varA - varB

    const placedA = a.placements.length
    const placedB = b.placements.length
    if (placedB !== placedA) return placedB - placedA
    return (a.scenarioId ?? '').localeCompare(b.scenarioId ?? '')
  })
}

/** True when any candidate achieves a complete full-roster layout. */
export function anyCandidateHasFullCoverage(
  candidates: LayoutResult[]
): boolean {
  return candidates.some(isFullRosterComplete)
}

/**
 * Run multiple fairness layout scenarios (serpentine axis, aisle bias, anneal seeds)
 * and return ranked candidates — full roster complete first, then capacity, coverage, fairness.
 */
export function generateFairLayoutCandidates(
  request: LayoutRequest,
  options: FairLayoutCandidatesOptions = {}
): LayoutResult[] {
  const totalBudget = options.timeBudgetMs ?? DEFAULT_MULTI_SCENARIO_BUDGET_MS
  const scenarioConfigs = fairLayoutScenarioConfigsForRequest(
    request,
    options.scenarioCount
  )
  if (scenarioConfigs.length === 0) {
    return [generateFairLayout(request)]
  }

  const perScenarioBudget = Math.max(
    350,
    Math.floor(totalBudget / scenarioConfigs.length)
  )

  const candidates = scenarioConfigs.map((scenario, index) =>
    generateFairLayout(request, {
      ...scenario,
      annealingTimeBudgetMs: perScenarioBudget,
      skipTrafficSeed: index > 0,
    })
  )

  return rankCandidates(candidates)
}

/**
 * Multi-scenario fairness run that yields between scenarios so the layout
 * editor stays responsive while AI Auto-Arrange evaluates alternates.
 */
export async function generateFairLayoutCandidatesAsync(
  request: LayoutRequest,
  options: FairLayoutCandidatesOptions = {}
): Promise<LayoutResult[]> {
  const totalBudget = options.timeBudgetMs ?? DEFAULT_MULTI_SCENARIO_BUDGET_MS
  const scenarioConfigs = fairLayoutScenarioConfigsForRequest(
    request,
    options.scenarioCount
  )
  if (scenarioConfigs.length === 0) {
    return [generateFairLayout(request)]
  }

  const perScenarioBudget = Math.max(
    350,
    Math.floor(totalBudget / scenarioConfigs.length)
  )

  const candidates: LayoutResult[] = []
  for (let index = 0; index < scenarioConfigs.length; index++) {
    if (index > 0) {
      await nextAnimationFrame()
    }
    const scenario = scenarioConfigs[index]!
    candidates.push(
      generateFairLayout(request, {
        ...scenario,
        annealingTimeBudgetMs: perScenarioBudget,
        skipTrafficSeed: index > 0,
      })
    )
  }

  return rankCandidates(candidates)
}

/** Pick the highest-scoring candidate (expects ranked list from {@link generateFairLayoutCandidates}). */
export function pickBestFairLayoutCandidate(
  candidates: LayoutResult[]
): LayoutResult {
  if (candidates.length === 0) {
    throw new Error('pickBestFairLayoutCandidate requires at least one candidate')
  }
  return rankCandidates(candidates)[0]!
}
