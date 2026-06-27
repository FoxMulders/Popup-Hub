import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { partitionEventsByPhase, sortEventsByStartAsc } from '@/lib/queries/events'
import type { Event } from '@/types/database'

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
  const eventsQuery = supabase
    .from('events')
    .select('id, name, start_at, status')
    .order('start_at', { ascending: true })

  const { data: eventRows } = scope.isAdmin
    ? await eventsQuery
    : await eventsQuery.eq('coordinator_id', user.id)

  const { active } = partitionEventsByPhase((eventRows ?? []) as Event[])
  const markets = sortEventsByStartAsc(active).map((e) => ({
    id: e.id,
    name: e.name,
  }))

  return NextResponse.json({ markets })
}
