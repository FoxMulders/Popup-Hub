import { NextResponse } from 'next/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { getCoordinatorScope, applyCoordinatorEventScope } from '@/lib/events/coordinator-event-query'
import { onMarketPublished } from '@/lib/organizers/on-market-published'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
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

  const scope = await getCoordinatorScope(supabase, user.id)
  const { data: event, error } = await applyCoordinatorEventScope(
    supabase.from('events').select('id, status').eq('id', eventId),
    user.id,
    scope.isAdmin
  ).maybeSingle()

  if (error || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (event.status !== 'published') {
    return NextResponse.json({ error: 'Event is not published' }, { status: 409 })
  }

  const service = await createServiceClient()
  await onMarketPublished(service, eventId)

  return NextResponse.json({ ok: true })
}
