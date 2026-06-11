import { NextResponse } from 'next/server'
import { canActAsCoordinator, isPlatformAdmin } from '@/lib/auth/rbac'
import {
  COORDINATOR_FRAUD_PROFILE_SELECT,
  coordinatorPublishBlockReason,
} from '@/lib/coordinator/verification'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import {
  persistEventDraft,
  type DayRowPayload,
  type EventDraftPayloadInput,
} from '@/lib/wizard/wizard-autosave'
import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'

type DraftRequestBody = {
  eventId?: string | null
  draft?: EventDraftPayloadInput
  categoryLimits?: CategoryLimit[]
  dayRows?: DayRowPayload[]
  scheduleType?: 'single' | 'multi'
}

const RLS_DENIED_MESSAGE =
  'Could not save market — your account must be signed in as a coordinator with permission to host markets.'

export async function POST(request: Request) {
  const authSupabase = await createClient()
  const {
    data: { user },
  } = await authSupabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await authSupabase
    .from('profiles')
    .select(`role, is_admin, ${COORDINATOR_FRAUD_PROFILE_SELECT}`)
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  if (profile?.role !== 'coordinator' && !isPlatformAdmin(profile)) {
    return NextResponse.json(
      {
        error:
          'Market hosting requires a coordinator account. Sign in with a coordinator profile or complete coordinator signup.',
      },
      { status: 403 }
    )
  }

  let body: DraftRequestBody
  try {
    body = (await request.json()) as DraftRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!body.draft || !body.scheduleType) {
    return NextResponse.json({ error: 'draft and scheduleType are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const eventId = body.eventId ?? null

  const publishing = body.draft?.status === 'published'

  if (publishing) {
    const { data: squareEvent } = await authSupabase
      .from('events')
      .select('id')
      .eq('coordinator_id', user.id)
      .not('square_merchant_id', 'is', null)
      .limit(1)
      .maybeSingle()

    const publishBlock = coordinatorPublishBlockReason({
      ...profile,
      has_square_event: !!squareEvent,
    })
    if (publishBlock) {
      return NextResponse.json({ error: publishBlock }, { status: 403 })
    }
  }

  if (eventId) {
    const { data: existing, error: existingError } = await admin
      .from('events')
      .select('coordinator_id')
      .eq('id', eventId)
      .maybeSingle()

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (existing.coordinator_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const result = await persistEventDraft(
    admin,
    eventId,
    { ...body.draft, coordinatorId: user.id },
    body.categoryLimits ?? [],
    body.dayRows ?? [],
    body.scheduleType,
    { coordinatorId: user.id }
  )

  if (result.error) {
    const message = result.error.message
    const isRls =
      message.includes('42501') ||
      message.toLowerCase().includes('row-level security')
    return NextResponse.json(
      { error: isRls ? RLS_DENIED_MESSAGE : message },
      { status: isRls ? 403 : 500 }
    )
  }

  return NextResponse.json({ eventId: result.eventId })
}
