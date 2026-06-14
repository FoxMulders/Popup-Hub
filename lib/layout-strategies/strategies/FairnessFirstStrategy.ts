import type { LayoutStrategy } from '../LayoutStrategy'
import type { LayoutRequest, LayoutResult } from '../types'
import { generateFairLayout } from '../fairness-engine/generate-fair-layout'

/** Vendor fairness optimization — exposure sim + simulated annealing. */
export class FairnessFirstStrategy implements LayoutStrategy {
  async generateLayout(request: LayoutRequest): Promise<LayoutResult> {
    return generateFairLayout(request)
  }
}

export const fairnessFirstStrategy = new FairnessFirstStrategy()
