/**
 * Streaming layout JSON handler — progressive parse of floor-plan AI output.
 */

export interface StreamingLayoutChunk {
  /** Raw text delta from the model stream. */
  delta: string
  /** Accumulated text so far. */
  accumulated: string
  /** Partial placements parsed when a complete JSON object is available. */
  partialPlacements?: Array<{ id: string; x: number; y: number; rotation?: number }>
}

export interface ParsedStreamingLayout {
  placements: Array<{ id: string; x: number; y: number; rotation?: number }>
  rationale?: string
  raw: string
}

/** Extract placements array from partial JSON (best-effort during stream). */
function tryParsePartialPlacements(
  text: string
): Array<{ id: string; x: number; y: number; rotation?: number }> | undefined {
  const match = text.match(/"placements"\s*:\s*\[([\s\S]*?)(?:\]|$)/)
  if (!match) return undefined

  const arrayBody = match[1]
  const objects: Array<{ id: string; x: number; y: number; rotation?: number }> = []
  const objRegex =
    /\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"x"\s*:\s*([\d.+-]+)\s*,\s*"y"\s*:\s*([\d.+-]+)(?:\s*,\s*"rotation"\s*:\s*([\d.+-]+))?\s*\}/g

  let m: RegExpExecArray | null
  while ((m = objRegex.exec(arrayBody)) !== null) {
    objects.push({
      id: m[1],
      x: Number(m[2]),
      y: Number(m[3]),
      rotation: m[4] != null ? Number(m[4]) : undefined,
    })
  }
  return objects.length > 0 ? objects : undefined
}

/** Process one SSE delta from OpenRouter into a layout chunk. */
export function processLayoutStreamDelta(
  delta: string,
  accumulated: string
): StreamingLayoutChunk {
  const next = accumulated + delta
  const partialPlacements = tryParsePartialPlacements(next)
  return { delta, accumulated: next, partialPlacements }
}

/** Parse final streamed layout JSON. */
export function parseStreamedLayoutJson(raw: string): ParsedStreamingLayout {
  const trimmed = raw.trim()
  const jsonStart = trimmed.indexOf('{')
  const jsonEnd = trimmed.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    throw new Error('Streamed layout did not contain JSON')
  }

  const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as {
    placements?: Array<{ id: string; x: number; y: number; rotation?: number }>
    rationale?: string
  }

  if (!Array.isArray(parsed.placements)) {
    throw new Error('Streamed layout missing placements array')
  }

  return {
    placements: parsed.placements.map((p) => ({
      id: String(p.id),
      x: Number(p.x),
      y: Number(p.y),
      rotation: p.rotation != null ? Number(p.rotation) : undefined,
    })),
    rationale: parsed.rationale,
    raw: trimmed,
  }
}

/** Create an SSE encoder for Next.js streaming responses. */
export function createLayoutSseStream(
  source: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let accumulated = ''

  return new ReadableStream({
    async start(controller) {
      const reader = source.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (!value) continue

          const text = decoder.decode(value, { stream: true })
          const lines = text.split('\n')
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const payload = line.slice(6).trim()
            if (payload === '[DONE]') continue

            try {
              const json = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>
              }
              const delta = json.choices?.[0]?.delta?.content ?? ''
              if (!delta) continue

              accumulated += delta
              const chunk = processLayoutStreamDelta(delta, accumulated.slice(0, -delta.length))
              const event = JSON.stringify({
                type: 'delta',
                delta,
                partialPlacements: chunk.partialPlacements,
              })
              controller.enqueue(encoder.encode(`data: ${event}\n\n`))
            } catch {
              // skip malformed SSE lines
            }
          }
        }

        try {
          const final = parseStreamedLayoutJson(accumulated)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'complete', ...final })}\n\n`)
          )
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Parse failed'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
          )
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (err) {
        controller.error(err)
      } finally {
        reader.releaseLock()
      }
    },
  })
}
