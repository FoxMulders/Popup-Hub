import type { SupabaseClient } from '@supabase/supabase-js'
import { refundSquarePayment } from '@/lib/square/refunds'
import { sendEmail } from '@/lib/email/send'
import type { EventCancellationReason } from '@/lib/coordinator/cancellation-reasons'
import {
  getCancellationReasonLabel,
  isValidCancellationReason,
} from '@/lib/coordinator/cancellation-reasons'
import {
  applyCoordinatorReliabilityPenalty,
  computeNoticeDays,
} from '@/lib/coordinator/reliability-penalty'

export interface CancelEventResult {
  ok: boolean
  error?: string
  refundsAttempted: number
  refundsSucceeded: number
  refundsFailed: number
  vendorsNotified: number
  reliabilityPenalty?: number
  isLateCancellation?: boolean
  newReliabilityScore?: number
}

interface PaidApplicationRow {
  id: string
  vendor_id: string
  square_payment_id: string | null
  payment_status: string
  platform_transaction_id: string | null
}

async function resolveRefundAmountCents(
  supabase: SupabaseClient,
  app: PaidApplicationRow & { event_id?: string; category_id?: string }
): Promise<number | null> {
  if (app.platform_transaction_id) {
    const { data: tx } = await supabase
      .from('platform_transactions')
      .select('total_amount_charged')
      .eq('id', app.platform_transaction_id)
      .maybeSingle()
    if (tx?.total_amount_charged) return tx.total_amount_charged as number
  }

  if (app.square_payment_id) {
    const { data: tx } = await supabase
      .from('platform_transactions')
      .select('total_amount_charged')
      .eq('processor_charge_id', app.square_payment_id)
      .maybeSingle()
    if (tx?.total_amount_charged) return tx.total_amount_charged as number
  }

  if (app.event_id && app.category_id) {
    const { data: limit } = await supabase
      .from('event_category_limits')
      .select('price_per_booth')
      .eq('event_id', app.event_id)
      .eq('category_id', app.category_id)
      .maybeSingle()
    if (limit?.price_per_booth) return limit.price_per_booth as number
  }

  return null
}

/**
 * Cancel an event: refund paid approved vendors via Square, audit failures,
 * mark applications cancelled, and notify vendors (in-app + email).
 */
export async function cancelEventWithRefunds(
  supabase: SupabaseClient,
  params: {
    eventId: string
    coordinatorId: string
    cancellationReason: string
    cancellationReasonNotes?: string | null
  }
): Promise<CancelEventResult> {
  const { eventId, coordinatorId, cancellationReasonNotes } = params

  if (!isValidCancellationReason(params.cancellationReason)) {
    return {
      ok: false,
      error: 'A valid cancellation reason is required',
      refundsAttempted: 0,
      refundsSucceeded: 0,
      refundsFailed: 0,
      vendorsNotified: 0,
    }
  }

  const reason = params.cancellationReason as EventCancellationReason
  if (reason === 'other' && !cancellationReasonNotes?.trim()) {
    return {
      ok: false,
      error: 'Please provide details for "Other" cancellation reason',
      refundsAttempted: 0,
      refundsSucceeded: 0,
      refundsFailed: 0,
      vendorsNotified: 0,
    }
  }

  const reasonLabel = getCancellationReasonLabel(reason, cancellationReasonNotes)
  const cancelledAt = new Date()

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, name, status, coordinator_id, start_at, location_name')
    .eq('id', eventId)
    .eq('coordinator_id', coordinatorId)
    .single()

  if (eventError || !event) {
    return { ok: false, error: 'Event not found or access denied', refundsAttempted: 0, refundsSucceeded: 0, refundsFailed: 0, vendorsNotified: 0 }
  }

  if (event.status === 'cancelled') {
    return { ok: false, error: 'Event is already cancelled', refundsAttempted: 0, refundsSucceeded: 0, refundsFailed: 0, vendorsNotified: 0 }
  }

  if (event.status === 'completed') {
    return { ok: false, error: 'Completed events cannot be cancelled', refundsAttempted: 0, refundsSucceeded: 0, refundsFailed: 0, vendorsNotified: 0 }
  }

  const { data: paidApps, error: appsError } = await supabase
    .from('booth_applications')
    .select('id, vendor_id, event_id, category_id, square_payment_id, payment_status, platform_transaction_id')
    .eq('event_id', eventId)
    .eq('status', 'approved')
    .eq('payment_status', 'paid')

  if (appsError) {
    return { ok: false, error: appsError.message, refundsAttempted: 0, refundsSucceeded: 0, refundsFailed: 0, vendorsNotified: 0 }
  }

  let refundsAttempted = 0
  let refundsSucceeded = 0
  let refundsFailed = 0

  for (const app of (paidApps ?? []) as PaidApplicationRow[]) {
    try {
      if (!app.square_payment_id) {
        await supabase.from('refund_exceptions').insert({
          event_id: eventId,
          booth_application_id: app.id,
          coordinator_id: coordinatorId,
          vendor_id: app.vendor_id,
          square_payment_id: 'missing',
          amount_cents: 1,
          error_message: 'Approved paid application has no square_payment_id',
          status: 'pending_retry',
        })
        refundsFailed++
        continue
      }

      const amountCents = await resolveRefundAmountCents(supabase, app)
      if (!amountCents || amountCents <= 0) {
        await supabase.from('refund_exceptions').insert({
          event_id: eventId,
          booth_application_id: app.id,
          coordinator_id: coordinatorId,
          vendor_id: app.vendor_id,
          square_payment_id: app.square_payment_id,
          amount_cents: 1,
          error_message: 'Could not resolve refund amount from platform_transactions',
          status: 'pending_retry',
        })
        refundsFailed++
        continue
      }

      refundsAttempted++
      const idempotencyKey = `cx-${app.id}`.slice(0, 45)
      const { refundId, error: refundError } = await refundSquarePayment({
        paymentId: app.square_payment_id,
        amountCents,
        reason: `Popup Hub: event "${event.name}" cancelled`,
        idempotencyKey,
      })

      if (refundError || !refundId) {
        await supabase.from('refund_exceptions').insert({
          event_id: eventId,
          booth_application_id: app.id,
          coordinator_id: coordinatorId,
          vendor_id: app.vendor_id,
          square_payment_id: app.square_payment_id,
          amount_cents: amountCents,
          error_message: refundError ?? 'Unknown refund error',
          status: 'pending_retry',
          metadata: { last_attempt_at: new Date().toISOString() },
        })
        refundsFailed++
        continue
      }

      await supabase
        .from('booth_applications')
        .update({
          payment_status: 'refunded',
          status: 'cancelled',
          event_cancellation_reason: reason,
          event_cancellation_reason_label: reasonLabel,
        })
        .eq('id', app.id)

      await supabase
        .from('platform_transactions')
        .update({ status: 'refunded' })
        .eq('processor_charge_id', app.square_payment_id)

      refundsSucceeded++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected refund error'
      await supabase.from('refund_exceptions').insert({
        event_id: eventId,
        booth_application_id: app.id,
        coordinator_id: coordinatorId,
        vendor_id: app.vendor_id,
        square_payment_id: app.square_payment_id ?? 'unknown',
        amount_cents: 1,
        error_message: message,
        status: 'pending_retry',
        metadata: { last_attempt_at: new Date().toISOString(), thrown: true },
      })
      refundsFailed++
    }
  }

  const noticeDays = computeNoticeDays(cancelledAt, new Date(event.start_at))

  const { data: coordinatorProfile } = await supabase
    .from('profiles')
    .select('reliability_score, coordinator_cancellation_count, coordinator_late_cancellation_count')
    .eq('id', coordinatorId)
    .single()

  const penaltyResult = applyCoordinatorReliabilityPenalty({
    currentScore: (coordinatorProfile?.reliability_score as number) ?? 100,
    cancellationCount: (coordinatorProfile?.coordinator_cancellation_count as number) ?? 0,
    lateCancellationCount: (coordinatorProfile?.coordinator_late_cancellation_count as number) ?? 0,
    noticeDays,
    reason,
  })

  await supabase
    .from('booth_applications')
    .update({
      status: 'cancelled',
      event_cancellation_reason: reason,
      event_cancellation_reason_label: reasonLabel,
    })
    .eq('event_id', eventId)
    .in('status', ['pending', 'approved', 'waitlisted'])

  const { error: cancelError } = await supabase
    .from('events')
    .update({
      status: 'cancelled',
      cancellation_reason: reason,
      cancellation_reason_notes: cancellationReasonNotes?.trim() || null,
      cancelled_at: cancelledAt.toISOString(),
      cancellation_notice_days: penaltyResult.noticeDays,
      cancellation_penalty_applied: penaltyResult.penaltyPoints,
    })
    .eq('id', eventId)

  if (cancelError) {
    return {
      ok: false,
      error: cancelError.message,
      refundsAttempted,
      refundsSucceeded,
      refundsFailed,
      vendorsNotified: 0,
    }
  }

  const profileUpdate: Record<string, unknown> = {
    reliability_score: penaltyResult.newReliabilityScore,
    coordinator_cancellation_count: penaltyResult.newCancellationCount,
    coordinator_late_cancellation_count: penaltyResult.newLateCancellationCount,
  }
  if (penaltyResult.setRecentLateCancellation) {
    profileUpdate.recent_late_cancellation_at = cancelledAt.toISOString()
  }

  await supabase.from('profiles').update(profileUpdate).eq('id', coordinatorId)

  const { data: notifyApps } = await supabase
    .from('booth_applications')
    .select('vendor_id, vendor:profiles(id, full_name, email)')
    .eq('event_id', eventId)
    .in('status', ['pending', 'approved', 'waitlisted', 'cancelled'])

  const vendorMap = new Map<string, { email: string; name: string }>()
  for (const row of notifyApps ?? []) {
    const vendor = Array.isArray(row.vendor) ? row.vendor[0] : row.vendor
    if (!row.vendor_id || !vendor?.email) continue
    vendorMap.set(row.vendor_id, {
      email: vendor.email as string,
      name: (vendor.full_name as string) || 'Vendor',
    })
  }

  const eventDate = new Date(event.start_at).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const inAppMessage =
    `The market "${event.name}" on ${eventDate} at ${event.location_name} has been cancelled. ` +
    `Reason: ${reasonLabel}. ` +
    'Any booth fees you paid are being refunded to your original payment method.'

  let vendorsNotified = 0
  for (const [vendorId, { email, name }] of vendorMap) {
    await supabase.from('notifications').insert({
      user_id: vendorId,
      type: 'event_cancelled',
      message: inAppMessage,
      metadata: {
        event_id: eventId,
        event_name: event.name,
        cancellation_reason: reason,
        cancellation_reason_label: reasonLabel,
      },
    })

    const emailHtml = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;">
        <h1 style="color:#b45309;font-size:22px;">Market Cancelled</h1>
        <p>Hi ${name},</p>
        <p><strong>${event.name}</strong> scheduled for ${eventDate} at ${event.location_name} has been cancelled by the organizer.</p>
        <p><strong>Reason:</strong> ${reasonLabel}</p>
        <p>If you paid a booth fee, a <strong>full refund</strong> is being processed to your original payment method. Please allow 5–10 business days for funds to appear.</p>
        <p style="color:#6b7280;font-size:14px;">— Popup Hub</p>
      </div>
    `

    await sendEmail({
      to: email,
      subject: `[Popup Hub] ${event.name} has been cancelled`,
      html: emailHtml,
      text: inAppMessage,
    })

    vendorsNotified++
  }

  return {
    ok: true,
    refundsAttempted,
    refundsSucceeded,
    refundsFailed,
    vendorsNotified,
    reliabilityPenalty: penaltyResult.penaltyPoints,
    isLateCancellation: penaltyResult.isLate,
    newReliabilityScore: penaltyResult.newReliabilityScore,
  }
}
