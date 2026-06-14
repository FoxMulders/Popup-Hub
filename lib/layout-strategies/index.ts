export type {
  Point,
  Room,
  Booth,
  Entrance,
  Exit,
  LayoutRequest,
  BoothPlacement,
  LayoutResult,
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
export { computeFairnessScore } from './fairness-engine/fairness-scorer'
