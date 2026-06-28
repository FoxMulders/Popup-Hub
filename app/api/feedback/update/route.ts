import { NextResponse } from 'next/server'
import { resolveAdminDb } from '@/lib/auth/require-admin'
import { isValidFeatureRequestStatus } from '@/lib/feedback/feature-request-admin-config'
import { notifySubmitterFeatureRequestResolved } from '@/lib/feedback/notify-submitter-feature-request-resolved'
import { createServiceClient } from '@/lib/supabase/server'
import type { FeatureRequestStatus } from '@/types/database'

const ADMIN_SELECT_COLUMNS =
  'id, user_id, session_role, submitter_role, title, target_component, problem, dream_solution, impact_level, screenshot_url, page_path, status, developer_notes, resolution_notes, resolved_at, reopened_at, created_at, updated_at'

function isTerminalStatus(status: FeatureRequestStatus): boolean {
  return status === 'completed' || status === 'declined'
}

/**
 * PATCH /api/feedback/update
 * Admin-only: update feature request status, resolution notes, and developer notes.
 */
export async function PATCH(request: Request) {
  const adminContext = await resolveAdminDb(request)
  if (!adminContext.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    id?: string
    status?: string
    developer_notes?: string | null
    resolution_notes?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const id = body.id?.trim()
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const { data: existing, error: fetchError } = await adminContext.db
    .from('feature_requests')
    .select('id, user_id, title, status, resolution_notes')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json({ error: 'Feature request not found' }, { status: 404 })
  }

  const now = new Date().toISOString()
  const updates: {
    status?: string
    developer_notes?: string | null
    resolution_notes?: string | null
    resolved_at?: string | null
    reopened_at?: string | null
    updated_at: string
  } = {
    updated_at: now,
  }

  let nextStatus: FeatureRequestStatus | undefined

  if (body.status !== undefined) {
    if (!isValidFeatureRequestStatus(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    nextStatus = body.status
    updates.status = body.status

    if (isTerminalStatus(body.status)) {
      updates.resolved_at = now
      updates.reopened_at = null
    } else {
      updates.resolved_at = null
    }
  }

  if (body.developer_notes !== undefined) {
    const notes = body.developer_notes
    updates.developer_notes =
      typeof notes === 'string' && notes.trim().length > 0 ? notes.trim() : null
  }

  if (body.resolution_notes !== undefined) {
    const notes = body.resolution_notes
    updates.resolution_notes =
      typeof notes === 'string' && notes.trim().length > 0 ? notes.trim() : null
  }

  const hasFieldUpdates =
    updates.status !== undefined ||
    'developer_notes' in updates ||
    'resolution_notes' in updates

  if (!hasFieldUpdates) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: row, error } = await adminContext.db
    .from('feature_requests')
    .update(updates)
    .eq('id', id)
    .select(ADMIN_SELECT_COLUMNS)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!row) {
    return NextResponse.json({ error: 'Feature request not found' }, { status: 404 })
  }

  const statusChangedToTerminal =
    nextStatus !== undefined &&
    isTerminalStatus(nextStatus) &&
    existing.status !== nextStatus

  if (statusChangedToTerminal && nextStatus !== undefined) {
    const service = await createServiceClient()
    await notifySubmitterFeatureRequestResolved(service, {
      userId: existing.user_id,
      featureRequestId: id,
      title: existing.title,
      status: nextStatus,
      resolutionNotes:
        updates.resolution_notes !== undefined
          ? updates.resolution_notes
          : existing.resolution_notes,
    })
  }

  return NextResponse.json({ ok: true, request: row })
}
