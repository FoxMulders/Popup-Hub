import { NextResponse } from 'next/server'
import { resolveAdminDb } from '@/lib/auth/require-admin'
import { isValidFeatureRequestStatus } from '@/lib/feedback/feature-request-admin-config'

/**
 * PATCH /api/feedback/update
 * Admin-only: update feature request status and developer notes.
 */
export async function PATCH(request: Request) {
  const adminContext = await resolveAdminDb(request)
  if (!adminContext.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { id?: string; status?: string; developer_notes?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const id = body.id?.trim()
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 })
  }

  const updates: {
    status?: string
    developer_notes?: string | null
    updated_at: string
  } = {
    updated_at: new Date().toISOString(),
  }

  if (body.status !== undefined) {
    if (!isValidFeatureRequestStatus(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    updates.status = body.status
  }

  if (body.developer_notes !== undefined) {
    const notes = body.developer_notes
    updates.developer_notes =
      typeof notes === 'string' && notes.trim().length > 0 ? notes.trim() : null
  }

  if (updates.status === undefined && !('developer_notes' in updates)) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: row, error } = await adminContext.db
    .from('feature_requests')
    .update(updates)
    .eq('id', id)
    .select(
      'id, user_id, session_role, submitter_role, title, target_component, problem, dream_solution, impact_level, screenshot_url, page_path, status, developer_notes, created_at, updated_at'
    )
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!row) {
    return NextResponse.json({ error: 'Feature request not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, request: row })
}
