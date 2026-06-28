import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import {
  createPublishAssistRequest,
  getPendingPublishAssistForEvent,
} from '@/lib/coordinator/publish-assist'

type RouteParams = { params: Promise<{ eventId: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  const { eventId } = await params
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
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, coordinator_id')
    .eq('id', eventId)
    .maybeSingle()

  if (!event || event.coordinator_id !== user.id) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const pending = await getPendingPublishAssistForEvent(supabase, eventId)
  return NextResponse.json({ pending })
}

export async function POST(request: Request, { params }: RouteParams) {
  const { eventId } = await params
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

  if (!canActAsCoordinator(profile) || profile?.role !== 'coordinator') {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  let body: { requestNote?: string } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    body = {}
  }

  const result = await createPublishAssistRequest(supabase, {
    eventId,
    coordinatorId: user.id,
    requestNote: body.requestNote,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true, request: result.request })
}
