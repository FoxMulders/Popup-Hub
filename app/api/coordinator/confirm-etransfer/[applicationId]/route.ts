import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  buildEtransferConfirmedContext,
  sendEtransferConfirmedEmail,
} from '@/lib/email/etransfer-confirmed'
import { resolveVendorDisplayName } from '@/lib/email/application-received'
import { recordPlatformTransaction } from '@/lib/monetization/record-transaction'
import type { Event } from '@/types/database'

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
      status,
      payment_method,
      application_payment_status,
      payment_status,
      etransfer_reference_code,
      event:events(
        id,
        name,
        coordinator_id,
        start_at,
        end_at,
        is_multi_day,
        event_days(id, event_id, date, start_time, end_time, sort_order)
      ),
      vendor:profiles!booth_applications_vendor_id_fkey(full_name, email),
      passport:vendor_passports(business_name)
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

  if (application.payment_method !== 'ETRANSFER') {
    return NextResponse.json({ error: 'Not an e-transfer application' }, { status: 400 })
  }

  if (application.application_payment_status !== 'PENDING_REVIEW') {
    return NextResponse.json({ error: 'Payment is not pending review' }, { status: 400 })
  }

  const { data: limit } = await serviceSupabase
    .from('event_category_limits')
    .select('price_per_booth')
    .eq('event_id', application.event_id)
    .eq('category_id', application.category_id)
    .maybeSingle()

  const boothPriceCents = limit?.price_per_booth ?? 0
  const referenceCode = application.etransfer_reference_code ?? 'N/A'

  const { error: updateError } = await serviceSupabase
    .from('booth_applications')
    .update({
      application_payment_status: 'COMPLETED',
      payment_status: 'paid',
    })
    .eq('id', applicationId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const { transactionId, error: txError } = await recordPlatformTransaction(serviceSupabase, {
    boothApplicationId: applicationId,
    eventId: application.event_id,
    vendorId: application.vendor_id,
    coordinatorId: user.id,
    categoryId: application.category_id,
    totalAmountCents: boothPriceCents,
    platformFeeCents: 0,
    feeModeUsed: 'flat',
    processorChargeId: `etransfer-${referenceCode}`,
    processorTransferId: null,
    status: 'completed',
  })

  if (txError) {
    console.error('[etransfer] transaction record failed:', txError)
  }

  const vendor = Array.isArray(application.vendor) ? application.vendor[0] : application.vendor
  const passport = Array.isArray(application.passport)
    ? application.passport[0]
    : application.passport

  if (vendor?.email) {
    await sendEtransferConfirmedEmail(
      buildEtransferConfirmedContext({
        vendorEmail: vendor.email,
        vendorName: resolveVendorDisplayName(passport, vendor),
        totalAmountCents: boothPriceCents,
        referenceCode,
        event: eventRow as Pick<
          Event,
          'name' | 'start_at' | 'end_at' | 'is_multi_day' | 'event_days'
        >,
      })
    )
  }

  return NextResponse.json({
    ok: true,
    applicationId,
    applicationPaymentStatus: 'COMPLETED',
    transactionId,
    revenueAddedCents: boothPriceCents,
  })
}
