import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { formatCoordinatorOwnerLabel } from '@/lib/coordinator/coordinator-owner-label'
import { partitionEventsByPhase, sortEventsByStartAsc } from '@/lib/queries/events'
import type { Event } from '@/types/database'

type MenuEventRow = Pick<Event, 'id' | 'name' | 'start_at' | 'status'> & {
  coordinator?:
    | {
        full_name?: string | null
        coordinator_organization_name?: string | null
        email?: string | null
      }
    | {
        full_name?: string | null
        coordinator_organization_name?: string | null
        email?: string | null
      }[]
    | null
}

/** Lightweight list for coordinator slide-out menu (active markets only). */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const scope = await getCoordinatorScope(supabase, user.id)
  const eventsQuery = scope.isAdmin
    ? supabase
        .from('events')
        .select(
          'id, name, start_at, status, coordinator:profiles!events_coordinator_id_fkey(full_name, coordinator_organization_name, email)'
        )
        .order('start_at', { ascending: true })
    : supabase.from('events').select('id, name, start_at, status').order('start_at', { ascending: true })

  const { data: eventRows } = scope.isAdmin
    ? await eventsQuery
    : await eventsQuery.eq('coordinator_id', user.id)

  const { active } = partitionEventsByPhase((eventRows ?? []) as Event[])
  const markets = sortEventsByStartAsc(active as MenuEventRow[]).map((e) => {
    const coordinator = Array.isArray(e.coordinator) ? e.coordinator[0] : e.coordinator
    const coordinatorName = scope.isAdmin ? formatCoordinatorOwnerLabel(coordinator) : undefined
    return {
      id: e.id,
      name: e.name,
      coordinatorName,
    }
  })

  return NextResponse.json({ markets })
}
