import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { isOpenRouterConfigured } from '@/lib/ai/env'
import { openRouterSpatialLayoutStream } from '@/lib/ai/spatial/client'
import type { OpenRouterMessage } from '@/lib/ai/openrouter'
import { compressedLayoutToJson, type CompressedLayout } from '@/lib/ai/spatial/compress'

export interface SpatialLayoutStreamRequest {
  roomName: string
  roomWidthFt: number
  roomLengthFt: number
  mode?: string
  compressedLayout?: CompressedLayout
  /** Optional extra context for the geometry worker. */
  instructions?: string
}

function buildStreamMessages(body: SpatialLayoutStreamRequest): OpenRouterMessage[] {
  const layout =
    body.compressedLayout ??
    ({
      canvas: [body.roomWidthFt, body.roomLengthFt],
      gridFt: 1,
      rooms: [{ i: 'room', n: body.roomName, b: [0, 0, body.roomWidthFt, body.roomLengthFt] }],
      objects: [],
    } satisfies CompressedLayout)

  return [
    {
      role: 'system',
      content:
        'You generate indoor market floor-plan coordinates. Stream JSON with a placements array. All units in feet, top-left origin. Geometry math only.',
    },
    {
      role: 'user',
      content: `ROOM: "${body.roomName}" — ${body.roomWidthFt}' × ${body.roomLengthFt}'.
MODE: ${body.mode ?? 'grid'}
COMPRESSED LAYOUT:
${compressedLayoutToJson(layout)}
${body.instructions ? `INSTRUCTIONS: ${body.instructions}` : ''}

Respond with JSON: { "placements": [{ "id", "x", "y", "rotation" }], "rationale": string }`,
    },
  ]
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { error: 'OpenRouter is not configured', code: 'AI_UNAVAILABLE' },
      { status: 503 }
    )
  }

  let body: SpatialLayoutStreamRequest
  try {
    body = (await request.json()) as SpatialLayoutStreamRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    !body.roomName ||
    !Number.isFinite(body.roomWidthFt) ||
    !Number.isFinite(body.roomLengthFt) ||
    body.roomWidthFt <= 0 ||
    body.roomLengthFt <= 0
  ) {
    return NextResponse.json({ error: 'Invalid spatial layout stream payload' }, { status: 400 })
  }

  try {
    const stream = await openRouterSpatialLayoutStream({
      messages: buildStreamMessages(body),
      temperature: 0.15,
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Spatial layout stream failed'
    console.error('[spatial-layout/stream]', message, err)
    return NextResponse.json({ error: message, code: 'AI_FAILED' }, { status: 502 })
  }
}
