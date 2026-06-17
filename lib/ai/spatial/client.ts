/**
 * Centralized spatial OpenRouter client — tier routing, max_price guardrails,
 * and advisor-ready chat/stream entry points.
 */

import {
  OpenRouterConfigError,
  OpenRouterRequestError,
  openRouterChatForTask,
  openRouterChatStream,
  type OpenRouterMessage,
  type OpenRouterProviderConfig,
} from '@/lib/ai/openrouter'
import { SPATIAL_MAX_PRICE } from '@/lib/ai/spatial/max-price'
import { routeSpatialTier, type SpatialTier } from '@/lib/ai/spatial/router'
import { createLayoutSseStream } from '@/lib/ai/spatial/stream'

export interface SpatialChatInput {
  tier: SpatialTier
  messages: OpenRouterMessage[]
  temperature?: number
  jsonMode?: boolean
}

export interface SpatialChatResult {
  content: string
  model: string
  tier: SpatialTier
  usedFallback: boolean
}

function providerForTier(tier: SpatialTier): OpenRouterProviderConfig {
  return {
    sort: tier === 'geometry' ? 'price' : undefined,
    max_price: { ...SPATIAL_MAX_PRICE[tier === 'geometry' ? 'geometry' : tier] },
  }
}

/** Spatial chat with hardcoded max_price guardrails per tier. */
export async function openRouterSpatialChat(input: SpatialChatInput): Promise<SpatialChatResult> {
  const route = routeSpatialTier(input.tier)

  const result = await openRouterChatForTask({
    task: route.task,
    messages: input.messages,
    temperature: input.temperature,
    jsonMode: input.jsonMode,
    provider: providerForTier(input.tier),
  })

  return {
    content: result.content,
    model: result.model,
    tier: input.tier,
    usedFallback: result.usedFallback,
  }
}

/** Stream layout geometry from the geometry tier — progressive SSE to client. */
export async function openRouterSpatialLayoutStream(input: {
  messages: OpenRouterMessage[]
  temperature?: number
}): Promise<ReadableStream<Uint8Array>> {
  const route = routeSpatialTier('geometry')

  const upstream = await openRouterChatStream({
    model: route.model,
    messages: input.messages,
    temperature: input.temperature ?? 0.1,
    jsonMode: true,
    provider: providerForTier('geometry'),
  })

  if (!upstream.body) {
    throw new OpenRouterRequestError('Stream body missing', 502, '', route.model)
  }

  return createLayoutSseStream(upstream.body)
}

export { OpenRouterConfigError, OpenRouterRequestError }
