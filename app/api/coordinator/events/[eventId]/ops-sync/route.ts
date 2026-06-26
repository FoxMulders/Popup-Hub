import { NextResponse } from 'next/server'
import { applyCoordinatorOpsMutation } from '@/lib/coordinator/ops-sync-mutations'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { PendingCoordinatorMutation } from '@/lib/pwa/coordinator-ops-offline'

export async function POST(
  request: Request,
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
  const { data: event, error: eventError } = await applyCoordinatorEventScope(
    supabase.from('events').select('id').eq('id', eventId),
    user.id,
    scope.isAdmin
  ).maybeSingle()

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const body = (await request.json()) as { mutations?: PendingCoordinatorMutation[] }
  const mutations = [...(body.mutations ?? [])].sort(
    (a, b) => a.clientTimestamp - b.clientTimestamp
  )

  const adminSupabase = createAdminClient()
  const appliedIds: string[] = []
  const conflicts: Array<{ id: string; reason: string }> = []

  for (const mutation of mutations) {
    if (mutation.eventId !== eventId) {
      conflicts.push({ id: mutation.id, reason: 'event_mismatch' })
      continue
    }

    try {
      const applied = await applyCoordinatorOpsMutation(
        supabase,
        adminSupabase,
        eventId,
        mutation
      )
      if (applied) appliedIds.push(mutation.id)
      else conflicts.push({ id: mutation.id, reason: 'apply_failed' })
    } catch {
      conflicts.push({ id: mutation.id, reason: 'apply_error' })
    }
  }

  return NextResponse.json({
    applied: appliedIds.length,
    appliedIds,
    conflicts,
  })
}
