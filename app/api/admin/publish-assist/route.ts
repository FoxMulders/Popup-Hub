import { NextResponse } from 'next/server'
import { hasAdminAccess } from '@/lib/auth/require-admin'
import { formatCoordinatorOwnerLabel } from '@/lib/coordinator/coordinator-owner-label'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  if (!(await hasAdminAccess())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = await createServiceClient()
  const { data, error } = await admin
    .from('event_publish_assist_requests')
    .select(
      `
      id,
      status,
      request_note,
      block_reason,
      created_at,
      event:events(id, name, status, start_at),
      coordinator:profiles!event_publish_assist_requests_coordinator_id_fkey(
        full_name,
        coordinator_organization_name,
        email
      )
    `
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const requests = (data ?? []).map((row) => {
    const eventRaw = row.event
    const event = (Array.isArray(eventRaw) ? eventRaw[0] : eventRaw) as {
      id: string
      name: string
      status: string
      start_at: string
    } | null
    const coordinatorRaw = row.coordinator
    const coordinator = (Array.isArray(coordinatorRaw) ? coordinatorRaw[0] : coordinatorRaw) as {
      full_name: string | null
      coordinator_organization_name: string | null
      email: string | null
    } | null

    return {
      id: row.id,
      status: row.status,
      request_note: row.request_note,
      block_reason: row.block_reason,
      created_at: row.created_at,
      event,
      coordinatorName: formatCoordinatorOwnerLabel(coordinator),
    }
  })

  return NextResponse.json({ requests })
}
