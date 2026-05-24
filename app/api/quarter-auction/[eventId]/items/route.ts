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

  const { data: approval } = await supabase
    .from('quarter_auction_vendor_approvals')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('vendor_id', user.id)
    .maybeSingle()

  if (!approval) {
    return NextResponse.json({ error: 'Vendor not approved for this auction' }, { status: 403 })
  }

  const body = await request.json()
  const { title, description, image_url, retail_value_cents } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { count } = await service
    .from('auction_catalog_items')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)

  const { data: item, error } = await service
    .from('auction_catalog_items')
    .insert({
      event_id: eventId,
      vendor_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      image_url: image_url || null,
      retail_value_cents: retail_value_cents ?? null,
      queue_position: count ?? 0,
      status: 'draft',
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 })
  }

  return NextResponse.json({ item })
}
