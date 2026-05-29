import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { dispatchEtransferInstructions } from '@/lib/applications/etransfer-instructions-service'
import { computeApplicationBoothPriceCents } from '@/lib/monetization/booth-pricing'
import type { EventListingType } from '@/types/database'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const { applicationId } = await params
  const supabase = await createClient()
  const serviceSupabase = await createServiceClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: application } = await serviceSupabase
    .from('booth_applications')
    .select(`
      id,
      vendor_id,
      event_id,
      category_id,
      payment_method,
      application_payment_status,
      etransfer_reference_code,
      etransfer_expires_at,
      event:events(coordinator_id)
    `)
    .eq('id', applicationId)
    .single()

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const eventRow = (Array.isArray(application.event)
    ? application.event[0]
    : application.event) as {
    coordinator_id: string
    listing_type?: EventListingType
    booth_price_cents?: number
    multi_table_discount_percent?: number
  } | null
  if (!eventRow || eventRow.coordinator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (application.payment_method !== 'ETRANSFER') {
    return NextResponse.json({ error: 'Not an e-transfer application' }, { status: 400 })
  }

  const { data: limit } = await serviceSupabase
    .from('event_category_limits')
    .select('price_per_booth')
    .eq('event_id', application.event_id)
    .eq('category_id', application.category_id)
    .maybeSingle()

  const result = await dispatchEtransferInstructions(serviceSupabase, {
    applicationId,
    eventId: application.event_id,
    vendorId: application.vendor_id,
    boothPriceCents: computeApplicationBoothPriceCents(
      limit?.price_per_booth,
      {
        listing_type: eventRow?.listing_type,
        booth_price_cents: eventRow?.booth_price_cents,
        multi_table_discount_percent: eventRow?.multi_table_discount_percent,
      },
      (application as { table_count?: number }).table_count ?? 1
    ),
    referenceCode: application.etransfer_reference_code,
    expiresAt: application.etransfer_expires_at,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Failed to send instructions' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    referenceCode: result.referenceCode,
    expiresAt: result.expiresAt,
  })
}
