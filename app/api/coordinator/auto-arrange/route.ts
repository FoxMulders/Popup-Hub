import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isOpenRouterConfigured } from '@/lib/ai/env'
import {
  optimizeLayoutWithAi,
  type AiAutoArrangeRequest,
} from '@/lib/floor-plan/ai-auto-arrange'

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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coordinator') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      { error: 'OpenRouter is not configured', code: 'AI_UNAVAILABLE' },
      { status: 503 }
    )
  }

  let body: AiAutoArrangeRequest
  try {
    body = (await request.json()) as AiAutoArrangeRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    !body.roomName ||
    !Number.isFinite(body.roomWidthFt) ||
    !Number.isFinite(body.roomLengthFt) ||
    body.roomWidthFt <= 0 ||
    body.roomLengthFt <= 0 ||
    !Array.isArray(body.items) ||
    body.items.length === 0
  ) {
    return NextResponse.json({ error: 'Invalid auto-arrange payload' }, { status: 400 })
  }

  try {
    const result = await optimizeLayoutWithAi(body)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Auto-arrange optimization failed'
    console.error('[auto-arrange]', message, err)
    return NextResponse.json({ error: message, code: 'AI_FAILED' }, { status: 502 })
  }
}
