import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  buildAuditStateFromUpdates,
  extractClientIp,
  mutateApplicationWithSecurityAudit,
  SECURITY_AUDIT_ACTION,
  snapshotApplicationAuditState,
} from '@/lib/audit/security-audit-log'
import {
  buildEtransferConfirmedContext,
  sendEtransferConfirmedEmail,
} from '@/lib/email/etransfer-confirmed'
import { resolveVendorDisplayName } from '@/lib/email/application-received'
import { extractNestedPassport } from '@/lib/applications/extract-nested-passport'
import { recordPlatformTransaction } from '@/lib/monetization/record-transaction'
import { resolvePostApprovalStatus } from '@/lib/applications/resolve-approval-status'
import type { ApplicationStatus, BoothApplication, Event } from '@/types/database'

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
      event:events(
        id,
        name,
        coordinator_id,
        status,
        market_insurance_required,
        start_at,
        end_at,
        is_multi_day,
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

  if (eventRow.status === 'cancelled') {
    return NextResponse.json({ error: 'Event is cancelled' }, { status: 409 })
  }

  if (application.payment_method !== 'ETRANSFER') {
    return NextResponse.json({ error: 'Not an e-transfer application' }, { status: 400 })
  }

  if (application.application_payment_status !== 'PENDING_REVIEW') {
    return NextResponse.json({ error: 'Payment is not pending review' }, { status: 400 })
  }

  /*
   * "Mark as Paid" is a single atomic clearing-and-approval action:
   *
   *   1. Flip application_payment_status → COMPLETED, payment_status → paid
   *   2. If the app is still sitting in pending / waitlisted, advance
   *      it to Approved (or Pending Insurance, if the market requires
   *      proof of insurance).
   *
   * If the app is already Approved (legacy rows applied before the
   * hard-gate change) we just clear payment without re-approving, so
   * the operation stays idempotent.
   */
  const shouldAdvanceStatus =
    application.status === 'pending' || application.status === 'waitlisted'

  if (shouldAdvanceStatus && application.category_id) {
    const { data: limit } = await serviceSupabase
      .from('event_category_limits')
      .select('max_slots, category:categories(name)')
      .eq('event_id', application.event_id)
      .eq('category_id', application.category_id)
      .maybeSingle()

    if (limit) {
      const { count, error: countError } = await serviceSupabase
        .from('booth_applications')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', application.event_id)
        .eq('category_id', application.category_id)
        .in('status', ['approved', 'pending_insurance'])
        .neq('id', applicationId)

      if (countError) {
        return NextResponse.json({ error: countError.message }, { status: 500 })
      }

      const reservedInCategory = count ?? 0
      if (reservedInCategory >= limit.max_slots) {
        const category = Array.isArray(limit.category)
          ? limit.category[0]
          : limit.category
        const categoryName = category?.name ?? 'This category'
        return NextResponse.json(
          {
            error: `${categoryName} is full (${limit.max_slots} slots) — cannot auto-approve. Mark a competing slot as Declined first, then retry Mark as Paid.`,
            code: 'category_full',
          },
          { status: 409 }
        )
      }
    }
  }

  const nextStatus: ApplicationStatus = shouldAdvanceStatus
    ? resolvePostApprovalStatus(eventRow.market_insurance_required)
    : (application.status as ApplicationStatus)

  const updates: Partial<BoothApplication> = {
    application_payment_status: 'COMPLETED',
    payment_status: 'paid',
    status: nextStatus,
  }

  if (shouldAdvanceStatus) {
    updates.approved_at = new Date().toISOString()
  }

  const { data: limit } = await serviceSupabase
    .from('event_category_limits')
    .select('price_per_booth')
    .eq('event_id', application.event_id)
    .eq('category_id', application.category_id)
    .maybeSingle()

  const boothPriceCents = limit?.price_per_booth ?? 0
  const referenceCode = application.etransfer_reference_code ?? 'N/A'

  const previousState = snapshotApplicationAuditState(application)
  const newState = buildAuditStateFromUpdates(previousState, updates)

  const mutation = await mutateApplicationWithSecurityAudit(serviceSupabase, {
    applicationId,
    actorId: user.id,
    targetVendorId: application.vendor_id,
    actionType: SECURITY_AUDIT_ACTION.MANUAL_PAYMENT_CLEARANCE,
    previousState,
    newState,
    updates,
    ipAddress: extractClientIp(request),
  })

  if (!mutation.ok) {
    return NextResponse.json({ error: mutation.error }, { status: 500 })
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

  /*
   * Vendor-facing notifications. The confirmed-payment email goes
   * out below. When the clearing also flipped the application from
   * Pending into Approved (or Pending Insurance), push the in-app
   * + SMS notification too so the vendor's dashboard reflects the
   * auto-approval immediately.
   */
  if (shouldAdvanceStatus) {
    try {
      const { sendSms } = await import('@/lib/twilio')
      const finalApprovedMessage =
        nextStatus === 'pending_insurance'
          ? '✅ Payment received! Upload your market insurance proof to finalize your approved booth.'
          : '✅ Payment received — your booth is approved! See you at the event.'

      await serviceSupabase.from('notifications').insert({
        user_id: application.vendor_id,
        type: 'application_approved',
        message: finalApprovedMessage,
        metadata: {
          application_id: applicationId,
          event_id: application.event_id,
          payment_method: 'ETRANSFER',
          payment_cleared: true,
        },
      })

      const { data: vendorProfile } = await serviceSupabase
        .from('profiles')
        .select('phone')
        .eq('id', application.vendor_id)
        .single()

      if (vendorProfile?.phone) {
        await sendSms(vendorProfile.phone, finalApprovedMessage)
      }
    } catch (notifyErr) {
      console.error('[etransfer] auto-approval notification failed:', notifyErr)
    }
  }

  const vendor = Array.isArray(application.vendor) ? application.vendor[0] : application.vendor
  const passport = extractNestedPassport(application)

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
    status: nextStatus,
    advancedToApproved: shouldAdvanceStatus,
    transactionId,
    revenueAddedCents: boothPriceCents,
    updates,
  })
}
