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

  const body = await request.json()

  if (body.action === 'approve_all') {
    const { data: event } = await supabase
      .from('events')
      .select('coordinator_id')
      .eq('id', eventId)
      .single()

    if (!event || event.coordinator_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const service = await createServiceClient()
    const { data: apps } = await service
      .from('booth_applications')
      .select('vendor_id')
      .eq('event_id', eventId)
      .eq('status', 'approved')

    const rows = (apps ?? []).map((a) => ({
      event_id: eventId,
      vendor_id: a.vendor_id,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    }))

    if (rows.length > 0) {
      const { error } = await service.from('quarter_auction_vendor_approvals').upsert(rows)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 422 })
      }
    }

    return NextResponse.json({ success: true, count: rows.length })
  }

  const { vendor_id, approved } = body as { vendor_id: string; approved: boolean }

  if (!vendor_id) {
    return NextResponse.json({ error: 'vendor_id required' }, { status: 400 })
  }

  const { data: event } = await supabase
    .from('events')
    .select('coordinator_id')
    .eq('id', eventId)
    .single()

  if (!event || event.coordinator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = await createServiceClient()

  if (approved) {
    const { error } = await service.from('quarter_auction_vendor_approvals').upsert({
      event_id: eventId,
      vendor_id,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
  } else {
    await service
      .from('quarter_auction_vendor_approvals')
      .delete()
      .eq('event_id', eventId)
      .eq('vendor_id', vendor_id)
  }

  return NextResponse.json({ success: true })
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { eventId } = await params
  const supabase = await createClient()

  const { data: approvals } = await supabase
    .from('quarter_auction_vendor_approvals')
    .select('*, vendor:profiles!quarter_auction_vendor_approvals_vendor_id_fkey(id, full_name, email)')
    .eq('event_id', eventId)

  const { data: pendingApps } = await supabase
    .from('booth_applications')
    .select('vendor_id, status, vendor:profiles!booth_applications_vendor_id_fkey(id, full_name, email)')
    .eq('event_id', eventId)
    .eq('status', 'approved')

  return NextResponse.json({
    approvals: approvals ?? [],
    approvedVendors: pendingApps ?? [],
  })
}
