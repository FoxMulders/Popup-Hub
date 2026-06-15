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

function isFullRouteCoverage(candidate: LayoutResult): boolean {
  const pct = candidate.coveragePercentage ?? candidate.diagnostics?.coveragePercentage ?? 0
  return pct >= 100 || candidate.layoutValid === true
}

function rankCandidates(candidates: LayoutResult[]): LayoutResult[] {
  return [...candidates].sort((a, b) => {
    const fullA = isFullRouteCoverage(a)
    const fullB = isFullRouteCoverage(b)
    if (fullA !== fullB) {
      return Number(fullB) - Number(fullA)
    }

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

/**
 * Run multiple fairness layout scenarios (serpentine axis, aisle bias, anneal seeds)
 * and return ranked candidates — full route coverage first, then fairness score.
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

/** Pick the highest-scoring candidate (expects ranked list from {@link generateFairLayoutCandidates}). */
export function pickBestFairLayoutCandidate(
  candidates: LayoutResult[]
): LayoutResult {
  if (candidates.length === 0) {
    throw new Error('pickBestFairLayoutCandidate requires at least one candidate')
  }
  return rankCandidates(candidates)[0]!
}
