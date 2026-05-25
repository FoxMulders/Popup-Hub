import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getCharitableImpactSnapshot } from '@/lib/charitable-impact/totals'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: eventId } = await params
  const service = await createServiceClient()

  const { data: event } = await service
    .from('events')
    .select('id, status, name')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (!['published', 'active', 'completed'].includes(event.status)) {
    return NextResponse.json({ error: 'Impact tracker unavailable for this event' }, { status: 422 })
  }

  const snapshot = await getCharitableImpactSnapshot(service, eventId)

  return NextResponse.json({
    eventId: snapshot.eventId,
    eventName: event.name,
    totalCents: snapshot.totalCents,
    milestones: snapshot.milestones,
    progress: snapshot.progress,
  })
}
