/**
 * Tiered model routing for floor-plan spatial workloads.
 * Never defaults to premium frontier models for routine coordinate math.
 */

import {
  resolveFallbackModelForTask,
  resolveModelForTask,
  type AiTask,
} from '@/lib/ai/tasks'
import type { SpatialPriceTier } from '@/lib/ai/spatial/max-price'

/** Spatial workload tiers — maps to OpenRouter model slugs in lib/ai/tasks.ts. */
export type SpatialTier = 'vision' | 'draft' | 'geometry' | 'advisor'

const TIER_TO_TASK: Record<SpatialTier, AiTask> = {
  vision: 'spatial_vision',
  draft: 'spatial_draft',
  geometry: 'spatial_geometry',
  advisor: 'spatial_advisor',
}

const TIER_TO_PRICE: Record<SpatialTier, SpatialPriceTier> = {
  vision: 'vision',
  draft: 'draft',
  geometry: 'geometry',
  advisor: 'advisor',
}

export interface SpatialModelRoute {
  tier: SpatialTier
  task: AiTask
  model: string
  fallbackModel: string | undefined
  priceTier: SpatialPriceTier
  /** True when model slug uses OpenRouter :floor provider routing. */
  usesFloorProvider: boolean
}

/** Resolve primary + fallback models for a spatial tier. */
export function routeSpatialTier(tier: SpatialTier): SpatialModelRoute {
  const task = TIER_TO_TASK[tier]
  const model = resolveModelForTask(task)
  return {
    tier,
    task,
    model,
    fallbackModel: resolveFallbackModelForTask(task),
    priceTier: TIER_TO_PRICE[tier],
    usesFloorProvider: model.includes(':floor'),
  }
}

/** Pick tier from workload kind — central routing entry point. */
export function routeSpatialWorkload(
  workload:
    | 'blueprint_vision'
    | 'floor_plan_image'
    | 'layout_evaluation'
    | 'layout_draft'
    | 'geometry_math'
    | 'coordinate_format'
    | 'room_labels'
    | 'collision_advisor'
): SpatialModelRoute {
  switch (workload) {
    case 'blueprint_vision':
    case 'floor_plan_image':
      return routeSpatialTier('vision')
    case 'layout_evaluation':
    case 'layout_draft':
      return routeSpatialTier('draft')
    case 'geometry_math':
    case 'coordinate_format':
    case 'room_labels':
      return routeSpatialTier('geometry')
    case 'collision_advisor':
      return routeSpatialTier('advisor')
  }
}

/** Append :floor when geometry tier model omits the provider shortcut. */
export function withFloorProvider(model: string): string {
  if (model.includes(':floor') || model.includes(':free') || model.includes(':nitro')) {
    return model
  }
  return `${model}:floor`
}
