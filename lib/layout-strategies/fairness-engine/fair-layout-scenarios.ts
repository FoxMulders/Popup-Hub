import type {
  FairLayoutScenarioOptions,
  LayoutRequest,
} from '../types'

/** Shared wall-clock budget for multi-scenario fairness runs (ms). */
export const DEFAULT_MULTI_SCENARIO_BUDGET_MS = 12_000

const SCENARIO_LIBRARY: ReadonlyArray<
  Omit<FairLayoutScenarioOptions, 'annealingTimeBudgetMs'>
> = [
  {
    scenarioId: 'vertical-classic',
    scenarioLabel: 'Vertical serpentine',
    primaryAxis: 'vertical',
    reverseFlow: false,
    aisleSideBias: 'both',
    annealingSeed: 101,
  },
  {
    scenarioId: 'horizontal-classic',
    scenarioLabel: 'Horizontal serpentine',
    primaryAxis: 'horizontal',
    reverseFlow: false,
    aisleSideBias: 'both',
    annealingSeed: 202,
  },
  {
    scenarioId: 'vertical-reverse',
    scenarioLabel: 'Vertical reverse flow',
    primaryAxis: 'vertical',
    reverseFlow: true,
    aisleSideBias: 'both',
    annealingSeed: 303,
  },
  {
    scenarioId: 'horizontal-reverse',
    scenarioLabel: 'Horizontal reverse flow',
    primaryAxis: 'horizontal',
    reverseFlow: true,
    aisleSideBias: 'both',
    annealingSeed: 404,
  },
  {
    scenarioId: 'left-bias',
    scenarioLabel: 'Left aisle bias',
    primaryAxis: 'vertical',
    aisleSideBias: 'left-first',
    annealingSeed: 505,
  },
  {
    scenarioId: 'right-bias',
    scenarioLabel: 'Right aisle bias',
    primaryAxis: 'vertical',
    aisleSideBias: 'right-first',
    annealingSeed: 606,
  },
  {
    scenarioId: 'anneal-alt-a',
    scenarioLabel: 'Anneal variant A',
    primaryAxis: 'vertical',
    aisleSideBias: 'both',
    annealingSeed: 707,
  },
  {
    scenarioId: 'anneal-alt-b',
    scenarioLabel: 'Anneal variant B',
    primaryAxis: 'horizontal',
    aisleSideBias: 'left-first',
    annealingSeed: 808,
  },
]

/** Cap scenario count by booth load — fewer variants for very large rooms. */
export function resolveFairLayoutScenarioCount(boothCount: number): number {
  if (boothCount >= 200) return 3
  if (boothCount >= 120) return 4
  if (boothCount >= 80) return 5
  if (boothCount >= 40) return 6
  return 7
}

export function buildFairLayoutScenarioConfigs(
  boothCount: number,
  scenarioCount?: number
): FairLayoutScenarioOptions[] {
  const count = Math.min(
    scenarioCount ?? resolveFairLayoutScenarioCount(boothCount),
    SCENARIO_LIBRARY.length
  )
  return SCENARIO_LIBRARY.slice(0, count).map((scenario) => ({ ...scenario }))
}

export function fairLayoutScenarioConfigsForRequest(
  request: LayoutRequest,
  scenarioCount?: number
): FairLayoutScenarioOptions[] {
  return buildFairLayoutScenarioConfigs(request.booths.length, scenarioCount)
}
