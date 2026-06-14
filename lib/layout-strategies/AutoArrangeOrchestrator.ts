import { DEFAULT_LAYOUT_MODE, LayoutMode } from './LayoutMode'
import type { LayoutStrategy } from './LayoutStrategy'
import { fairnessFirstStrategy } from './strategies/FairnessFirstStrategy'
import { trafficAwareStrategy } from './strategies/TrafficAwareStrategy'
import type { LayoutRequest, LayoutResult } from './types'

/**
 * Strategy orchestrator — spec name: AutoArrangeEngine.
 * Selects traffic-aware vs fairness-first without modifying underlying engines.
 */
export class AutoArrangeEngine {
  constructor(
    private strategies: Record<LayoutMode, LayoutStrategy> = {
      [LayoutMode.TRAFFIC_AWARE]: trafficAwareStrategy,
      [LayoutMode.FAIRNESS_FIRST]: fairnessFirstStrategy,
    }
  ) {}

  generateLayout(
    mode: LayoutMode = DEFAULT_LAYOUT_MODE,
    request: LayoutRequest
  ): Promise<LayoutResult> {
    const strategy =
      this.strategies[mode] ?? this.strategies[LayoutMode.TRAFFIC_AWARE]
    return strategy.generateLayout(request)
  }
}

export const defaultLayoutOrchestrator = new AutoArrangeEngine()

/** Alias for callers expecting orchestrator naming. */
export { AutoArrangeEngine as LayoutOrchestrator }
