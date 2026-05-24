import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ eventId: string }>
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

  const { data: event } = await supabase
    .from('events')
    .select('coordinator_id')
    .eq('id', eventId)
    .single()

  if (!event || event.coordinator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { orderedIds } = (await request.json()) as { orderedIds: string[] }
  if (!orderedIds?.length) {
    return NextResponse.json({ error: 'orderedIds required' }, { status: 400 })
  }

  const service = await createServiceClient()

  await Promise.all(
    orderedIds.map((id, index) =>
      service
        .from('auction_catalog_items')
        .update({ queue_position: index, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('event_id', eventId)
    )
  )

  return NextResponse.json({ success: true })
}
