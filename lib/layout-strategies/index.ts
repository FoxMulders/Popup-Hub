export type {
  Point,
  Room,
  Booth,
  Entrance,
  Exit,
  LayoutRequest,
  BoothPlacement,
  LayoutResult,
  LayoutOutcomeReason,
  LayoutCapacityReport,
  LayoutScores,
} from './types'

export {
  LayoutMode,
  FutureLayoutMode,
  DEFAULT_LAYOUT_MODE,
  parseLayoutMode,
  layoutModeLabel,
} from './LayoutMode'

export type { LayoutStrategy } from './LayoutStrategy'

export {
  AutoArrangeEngine,
  LayoutOrchestrator,
  defaultLayoutOrchestrator,
} from './AutoArrangeOrchestrator'

export {
  TrafficAwareStrategy,
  trafficAwareStrategy,
} from './strategies/TrafficAwareStrategy'

export {
  FairnessFirstStrategy,
  fairnessFirstStrategy,
} from './strategies/FairnessFirstStrategy'

export {
  layoutRequestFromDocRoom,
  applyLayoutResultToBooths,
  layoutResultMeta,
} from './adapters/floor-plan-doc-adapter'

export { generateFairLayout } from './fairness-engine/generate-fair-layout'
export {
  generateFairLayoutCandidates,
  generateFairLayoutCandidatesAsync,
  pickBestFairLayoutCandidate,
} from './fairness-engine/generate-fair-layout-candidates'
export {
  resolveFairLayoutScenarioCount,
  buildFairLayoutScenarioConfigs,
  DEFAULT_MULTI_SCENARIO_BUDGET_MS,
} from './fairness-engine/fair-layout-scenarios'
export {
  computeFairnessScore,
  evaluateFairness,
  meetsRelativeExposureThreshold,
  exposureVariance,
  applyRouteCoverageScoreCap,
  MAX_FAIRNESS_SCORE_PARTIAL_ROUTE,
  computeCapacityScore,
  computeCoverageScore,
  computeExposureFairnessScore,
  buildLayoutScores,
} from './fairness-engine/fairness-scorer'
export {
  classifyLayoutOutcome,
  isCompleteOutcome,
} from './fairness-engine/layout-outcome'
export { reduceToMaximumFairCapacity } from './fairness-engine/capacity-reducer'
export { runFairnessPlacementPipeline } from './fairness-engine/fairness-placement-pipeline'
export {
  computeRouteCoverage,
  hasFullRouteCoverage,
  buildPathfindingDocFromLayout,
} from './fairness-engine/route-coverage'
export {
  buildFairnessReport,
  exposureHeatmapGrid,
  exposureHeatmapToClearanceField,
} from './fairness-engine/fairness-report'
export type { FairnessDiagnostics, FairnessReport } from './types'
