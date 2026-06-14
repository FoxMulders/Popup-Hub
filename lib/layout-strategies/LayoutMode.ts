/** High-level vendor layout engine mode (distinct from grid/staggered/perimeter pattern). */

export enum LayoutMode {
  TRAFFIC_AWARE = 'traffic_aware',
  FAIRNESS_FIRST = 'fairness_first',
}

/** Reserved keys for future strategies — not registered in the orchestrator yet. */
export enum FutureLayoutMode {
  BALANCED = 'balanced',
  REVENUE_MAX = 'revenue_max',
  PREMIUM_BOOTH_OPTIMIZATION = 'premium_booth_optimization',
  EMERGENCY_FLOW_OPTIMIZATION = 'emergency_flow_optimization',
}

export type LayoutModeValue = LayoutMode | `${FutureLayoutMode}`

export const DEFAULT_LAYOUT_MODE = LayoutMode.TRAFFIC_AWARE

export function parseLayoutMode(
  raw: string | null | undefined
): LayoutMode {
  if (raw === LayoutMode.FAIRNESS_FIRST) return LayoutMode.FAIRNESS_FIRST
  return LayoutMode.TRAFFIC_AWARE
}

export function layoutModeLabel(mode: LayoutMode): string {
  switch (mode) {
    case LayoutMode.FAIRNESS_FIRST:
      return 'Fairness-first'
    case LayoutMode.TRAFFIC_AWARE:
    default:
      return 'Traffic-aware'
  }
}
