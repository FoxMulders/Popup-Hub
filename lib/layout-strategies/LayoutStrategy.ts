import type { LayoutRequest, LayoutResult } from './types'

export interface LayoutStrategy {
  generateLayout(request: LayoutRequest): Promise<LayoutResult>
}
