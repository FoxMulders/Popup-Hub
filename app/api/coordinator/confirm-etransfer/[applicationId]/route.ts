import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { extractClientIp } from '@/lib/audit/security-audit-log'
import { confirmOfflinePayment } from '@/lib/applications/confirm-offline-payment'

export async function POST(
  request: Request,
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
      status,
      payment_method,
      application_payment_status,
      payment_status,
      etransfer_reference_code,
      table_count,
      event:events(
        id,
        name,
        coordinator_id,
        listing_type,
        booth_price_cents,
        multi_table_discount_percent,
        status,
        market_insurance_required,
        start_at,
        end_at,
        is_multi_day,
        platform_fee_mode,
        platform_fee_flat_cents,
        platform_fee_bps,
        event_days(id, event_id, date, start_time, end_time, sort_order)
      ),
      vendor:profiles!booth_applications_vendor_id_fkey(
        full_name,
        email,
        passport:vendor_passports(business_name)
      )
    `)
    .eq('id', applicationId)
    .single()

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const eventRow = Array.isArray(application.event) ? application.event[0] : application.event
  if (!eventRow || eventRow.coordinator_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const result = await confirmOfflinePayment({
    supabase: serviceSupabase,
    application: application as unknown as Parameters<
      typeof confirmOfflinePayment
    >[0]['application'],
    actorId: user.id,
    ipAddress: extractClientIp(request),
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.status }
    )
  }

  return NextResponse.json({
    ok: true,
    applicationId: result.applicationId,
    applicationPaymentStatus: 'COMPLETED',
    status: result.status,
    advancedToApproved: result.advancedToApproved,
    transactionId: result.transactionId,
    revenueAddedCents: result.revenueAddedCents,
    platformFeeCents: result.platformFeeCents,
  })
}
