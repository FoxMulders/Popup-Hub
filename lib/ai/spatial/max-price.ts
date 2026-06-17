/**
 * Hardcoded spend guardrails for spatial OpenRouter workloads ($/M tokens).
 * Applied on every spatial API payload to prevent runaway coordinate loops.
 */

export interface OpenRouterMaxPrice {
  /** Max $/M prompt tokens. */
  prompt: number
  /** Max $/M completion tokens. */
  completion: number
  /** Max $ per image (vision workloads). */
  image?: number
  /** Max $ per request (when provider supports it). */
  request?: number
}

/** Per-tier ceilings — conservative; requests fail rather than overspend. */
export const SPATIAL_MAX_PRICE = {
  /** qwen3.7-plus vision parsing — multimodal blueprint uploads. */
  vision: { prompt: 0.5, completion: 2.0, image: 0.02 } satisfies OpenRouterMaxPrice,
  /** nex-n2-pro:free draft / evaluation. */
  draft: { prompt: 0, completion: 0 } satisfies OpenRouterMaxPrice,
  /** mistral-7b-instruct:floor geometry worker. */
  geometry: { prompt: 0.15, completion: 0.4 } satisfies OpenRouterMaxPrice,
  /** Advisor escalation — stronger reasoning on collision/logic errors only. */
  advisor: { prompt: 3.0, completion: 15.0 } satisfies OpenRouterMaxPrice,
} as const

export type SpatialPriceTier = keyof typeof SPATIAL_MAX_PRICE
