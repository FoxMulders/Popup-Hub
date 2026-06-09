import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { isOpenRouterConfigured } from '@/lib/ai/env'
import {
  recommendLayoutWithAi,
  type LayoutRecommendRequest,
} from '@/lib/floor-plan/ai-layout-recommend'

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
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[layout/recommend] OPENROUTER_API_KEY missing — AI layout feedback disabled'
      )
    }
    return NextResponse.json(
      { error: 'OpenRouter is not configured', code: 'AI_UNAVAILABLE' },
      { status: 503 }
    )
  }

  let body: LayoutRecommendRequest
  try {
    body = (await request.json()) as LayoutRecommendRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (
    !body.roomName ||
    !Number.isFinite(body.roomWidthFt) ||
    !Number.isFinite(body.roomLengthFt) ||
    body.roomWidthFt <= 0 ||
    body.roomLengthFt <= 0 ||
    !Array.isArray(body.objects) ||
    body.objects.length === 0 ||
    !Array.isArray(body.fixtures)
  ) {
    return NextResponse.json({ error: 'Invalid layout recommend payload' }, { status: 400 })
  }

  try {
    const result = await recommendLayoutWithAi(body)
    return NextResponse.json(result)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Layout recommendation failed'
    console.error('[layout/recommend]', message, err)
    return NextResponse.json({ error: message, code: 'AI_FAILED' }, { status: 502 })
  }
}
