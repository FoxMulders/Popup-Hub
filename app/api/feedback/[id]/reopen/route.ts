import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyAdminsOfFeatureRequestReopened } from '@/lib/feedback/notify-admins-feature-request-reopened'
import type { UserFeatureRequest } from '@/types/database'

interface RouteContext {
  params: Promise<{ id: string }>
}

const USER_FEATURE_REQUEST_COLUMNS =
  'id, title, status, resolution_notes, problem, dream_solution, impact_level, target_component, submitter_role, screenshot_url, page_path, created_at, updated_at, resolved_at, reopened_at'

/**
 * POST /api/feedback/[id]/reopen
 * Submitter reopens a completed feature request.
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let reopenReason: string | null = null
  try {
    const body = (await request.json()) as { reason?: string }
    if (typeof body.reason === 'string' && body.reason.trim().length > 0) {
      reopenReason = body.reason.trim()
    }
  } catch {
    // Body is optional
  }

  const { data: existing, error: fetchError } = await supabase
    .from('feature_requests')
    .select('id, user_id, title, status')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json({ error: 'Feature request not found' }, { status: 404 })
  }

  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (existing.status !== 'completed') {
    return NextResponse.json(
      { error: 'Only completed requests can be reopened' },
      { status: 400 }
    )
  }

  const now = new Date().toISOString()

  const service = await createServiceClient()
  const { data: row, error: updateError } = await service
    .from('feature_requests')
    .update({
      status: 'pending',
      reopened_at: now,
      resolved_at: null,
      updated_at: now,
    })
    .eq('id', id)
    .eq('user_id', user.id)
    .select(USER_FEATURE_REQUEST_COLUMNS)
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { data: reporter } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  await notifyAdminsOfFeatureRequestReopened(service, {
    featureRequestId: id,
    title: existing.title,
    reporterName: reporter?.full_name ?? null,
    reopenReason,
  })

  return NextResponse.json({ ok: true, request: row as UserFeatureRequest })
}
