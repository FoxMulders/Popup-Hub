import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateSettings } from '@/lib/quarter-auction/catalog'

interface RouteParams {
  params: Promise<{ eventId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: event } = await supabase
    .from('events')
    .select('id, name, coordinator_id, status')
    .eq('id', eventId)
    .single()

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const service = await createServiceClient()
  const settings = await getOrCreateSettings(service, eventId)

  const { data: items } = await supabase
    .from('auction_catalog_items')
    .select('*, vendor:profiles!auction_catalog_items_vendor_id_fkey(id, full_name, email, phone)')
    .eq('event_id', eventId)
    .order('queue_position', { ascending: true })

  return NextResponse.json({ event, settings, items: items ?? [] })
}

export async function PATCH(request: Request, { params }: RouteParams) {
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

  const body = await request.json()
  const service = await createServiceClient()

  const { data, error } = await service
    .from('quarter_auction_settings')
    .upsert(
      {
        event_id: eventId,
        enabled: body.enabled ?? true,
        paddle_purchase_credits: body.paddle_purchase_credits,
        default_entry_credits: body.default_entry_credits,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'event_id' }
    )
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 })
  }

  return NextResponse.json({ settings: data })
}
