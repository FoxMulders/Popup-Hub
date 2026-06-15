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
  return pct >= 100 - 1e-6 || candidate.layoutValid === true
}

function rankCandidates(candidates: LayoutResult[]): LayoutResult[] {
  return [...candidates].sort((a, b) => {
    const covA = a.coveragePercentage ?? a.diagnostics?.coveragePercentage ?? 0
    const covB = b.coveragePercentage ?? b.diagnostics?.coveragePercentage ?? 0
    const fullA = covA >= 100 - 1e-6 || a.layoutValid === true
    const fullB = covB >= 100 - 1e-6 || b.layoutValid === true
    if (fullA !== fullB) {
      return Number(fullB) - Number(fullA)
    }

    if (!fullA) {
      if (Math.abs(covB - covA) > 1e-6) return covB - covA
      return a.placements.length - b.placements.length
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

/** True when any candidate achieves 100% PathfindingService route coverage. */
export function anyCandidateHasFullCoverage(
  candidates: LayoutResult[]
): boolean {
  return candidates.some(
    (c) =>
      (c.coveragePercentage ?? 0) >= 100 - 1e-6 || c.layoutValid === true
  )
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
  const enforceWallClock = options.scenarioCount == null
  const deadline = Date.now() + totalBudget
  const scenarioConfigs = fairLayoutScenarioConfigsForRequest(
    request,
    options.scenarioCount
  )
  if (scenarioConfigs.length === 0) {
    return [generateFairLayout(request)]
  }

  const candidates: LayoutResult[] = []
  for (const [index, scenario] of scenarioConfigs.entries()) {
    if (enforceWallClock && index > 0 && Date.now() >= deadline) break

    const remaining = Math.max(0, deadline - Date.now())
    const perScenarioBudget = Math.max(
      250,
      Math.min(
        Math.floor(totalBudget / scenarioConfigs.length),
        remaining
      )
    )

    candidates.push(
      generateFairLayout(request, {
        ...scenario,
        annealingTimeBudgetMs: perScenarioBudget,
        skipTrafficSeed: index > 0,
      })
    )
  }

  if (candidates.length === 0) {
    candidates.push(generateFairLayout(request))
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
