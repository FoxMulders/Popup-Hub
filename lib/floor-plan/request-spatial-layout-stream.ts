/**
 * Client helper — stream layout geometry from the spatial AI geometry tier.
 * Progressive placements arrive via SSE; final `complete` event has full JSON.
 */

import {
  compressRoomLayout,
  type CompressedLayout,
} from '@/lib/ai/spatial/compress'
import type { ParsedStreamingLayout } from '@/lib/ai/spatial/stream'
import type { FloorPlanDoc } from '@/components/coordinator/floor-plan-v2/state/types'

export interface SpatialLayoutStreamOptions {
  roomName: string
  roomWidthFt: number
  roomLengthFt: number
  roomId?: string
  doc?: FloorPlanDoc
  mode?: string
  instructions?: string
  onPartial?: (placements: ParsedStreamingLayout['placements']) => void
}

export async function requestSpatialLayoutStream(
  options: SpatialLayoutStreamOptions
): Promise<ParsedStreamingLayout> {
  let compressedLayout: CompressedLayout | undefined
  if (options.doc && options.roomId) {
    compressedLayout = compressRoomLayout(options.doc, options.roomId)
  }

  const res = await fetch('/api/coordinator/spatial-layout/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomName: options.roomName,
      roomWidthFt: options.roomWidthFt,
      roomLengthFt: options.roomLengthFt,
      mode: options.mode,
      compressedLayout,
      instructions: options.instructions,
    }),
  })

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string }
    if (json.code === 'AI_UNAVAILABLE') {
      throw new Error('AI is not configured — set OPENROUTER_API_KEY.')
    }
    throw new Error(json.error ?? 'Spatial layout stream failed')
  }

  if (!res.body) {
    throw new Error('Spatial layout stream missing body')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let final: ParsedStreamingLayout | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') continue

      try {
        const event = JSON.parse(payload) as {
          type: string
          partialPlacements?: ParsedStreamingLayout['placements']
          placements?: ParsedStreamingLayout['placements']
          rationale?: string
          message?: string
        }

        if (event.type === 'delta' && event.partialPlacements?.length) {
          options.onPartial?.(event.partialPlacements)
        }
        if (event.type === 'complete' && event.placements) {
          final = {
            placements: event.placements,
            rationale: event.rationale,
            raw: JSON.stringify(event),
          }
        }
        if (event.type === 'error') {
          throw new Error(event.message ?? 'Stream parse error')
        }
      } catch (err) {
        if (err instanceof SyntaxError) continue
        throw err
      }
    }
  }

  if (!final) {
    throw new Error('Spatial layout stream ended without complete event')
  }

  return final
}
