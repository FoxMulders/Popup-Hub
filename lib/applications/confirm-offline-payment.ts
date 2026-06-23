import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildAuditStateFromUpdates,
  mutateApplicationWithSecurityAudit,
  SECURITY_AUDIT_ACTION,
  snapshotApplicationAuditState,
} from '@/lib/audit/security-audit-log'
import { extractNestedPassport } from '@/lib/applications/extract-nested-passport'
import { isOfflinePaymentMethod } from '@/lib/applications/payment-fields'
import { resolvePostApprovalStatus } from '@/lib/applications/resolve-approval-status'
import { PAYMENT_CHASE_CLEARED_FIELDS } from '@/lib/applications/payment-deadline'
import { resolveVendorDisplayName } from '@/lib/email/application-received'
import {
  buildEtransferConfirmedContext,
  sendEtransferConfirmedEmail,
} from '@/lib/email/etransfer-confirmed'
import { computeApplicationBoothPriceCents } from '@/lib/monetization/booth-pricing'
import { resolveEventFeeConfig } from '@/lib/monetization/fee-config'
import { computePlatformFeeCents } from '@/lib/monetization/fees'
import { recordPlatformTransaction } from '@/lib/monetization/record-transaction'
import { addCoordinatorPlatformFeeToBalance } from '@/lib/payments/account-balance'
import type {
  ApplicationPaymentStatus,
  ApplicationStatus,
  BoothApplication,
  Event,
  PaymentMethod,
  PaymentStatus,
} from '@/types/database'

type ConfirmOfflinePaymentInput = {
  supabase: SupabaseClient
  application: {
    id: string
    vendor_id: string
    event_id: string
    category_id: string
    status: ApplicationStatus
    payment_method: PaymentMethod | null
    application_payment_status: ApplicationPaymentStatus | null
    payment_status: PaymentStatus
    etransfer_reference_code: string | null
    table_count: number | null
    vendor?: {
      full_name: string | null
      email: string | null
      passport?: { business_name: string | null } | { business_name: string | null }[] | null
    } | null
    event?: Event | Event[] | null
  }
  actorId: string
  ipAddress: string | null
}

export async function confirmOfflinePayment(
  input: ConfirmOfflinePaymentInput
): Promise<
  | {
      ok: true
      applicationId: string
      status: ApplicationStatus
      advancedToApproved: boolean
      transactionId: string | null
      revenueAddedCents: number
      platformFeeCents: number
    }
  | { ok: false; error: string; code?: string; status: number }
> {
  const { supabase, application, actorId, ipAddress } = input
  const method = application.payment_method

  if (!method || !isOfflinePaymentMethod(method)) {
    return { ok: false, error: 'Not an offline payment application', status: 400 }
  }

  if (application.application_payment_status !== 'PENDING_REVIEW') {
    return { ok: false, error: 'Payment is not pending review', status: 400 }
  }

  const eventRow = Array.isArray(application.event)
    ? application.event[0]
    : application.event

  if (!eventRow) {
    return { ok: false, error: 'Event not found', status: 404 }
  }

  if (eventRow.status === 'cancelled') {
    return { ok: false, error: 'Event is cancelled', status: 409 }
  }

  const shouldAdvanceStatus =
    application.status === 'pending' || application.status === 'waitlisted'

  if (shouldAdvanceStatus && application.category_id) {
    const { data: limit } = await supabase
      .from('event_category_limits')
      .select('max_slots, category:categories(name)')
      .eq('event_id', application.event_id)
      .eq('category_id', application.category_id)
      .maybeSingle()

    if (limit) {
      const { count, error: countError } = await supabase
        .from('booth_applications')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', application.event_id)
        .eq('category_id', application.category_id)
        .in('status', ['approved', 'pending_insurance'])
        .neq('id', application.id)

      if (countError) {
        return { ok: false, error: countError.message, status: 500 }
      }

      const reservedInCategory = count ?? 0
      if (reservedInCategory >= limit.max_slots) {
        const category = Array.isArray(limit.category) ? limit.category[0] : limit.category
        const categoryName = category?.name ?? 'This category'
        return {
          ok: false,
          error: `${categoryName} is full (${limit.max_slots} slots) — cannot auto-approve. Mark a competing slot as Declined first, then retry Mark as Paid.`,
          code: 'category_full',
          status: 409,
        }
      }
    }
  }

  const { data: limit } = await supabase
    .from('event_category_limits')
    .select('price_per_booth')
    .eq('event_id', application.event_id)
    .eq('category_id', application.category_id)
    .maybeSingle()

  const boothPriceCents = computeApplicationBoothPriceCents(
    limit?.price_per_booth,
    {
      listing_type: eventRow.listing_type,
      booth_price_cents: eventRow.booth_price_cents,
      multi_table_discount_percent: eventRow.multi_table_discount_percent,
    },
    application.table_count ?? 1
  )

  const feeConfig = resolveEventFeeConfig(eventRow)
  const platformFeeCents = computePlatformFeeCents(boothPriceCents, feeConfig)

  const feeBalance = await addCoordinatorPlatformFeeToBalance(supabase, {
    coordinatorId: eventRow.coordinator_id,
    platformFeeCents,
    applicationId: application.id,
    paymentMethod: method,
  })

  if (!feeBalance.ok) {
    return { ok: false, error: 'Could not record platform fee balance', status: 500 }
  }

  const nextStatus: ApplicationStatus = shouldAdvanceStatus
    ? resolvePostApprovalStatus(eventRow.market_insurance_required)
    : application.status

  const updates: Partial<BoothApplication> = {
    application_payment_status: 'COMPLETED',
    payment_status: 'paid',
    status: nextStatus,
    ...PAYMENT_CHASE_CLEARED_FIELDS,
  }

  if (shouldAdvanceStatus) {
    updates.approved_at = new Date().toISOString()
  }

  const referenceCode = application.etransfer_reference_code ?? application.id.slice(0, 8).toUpperCase()
  const processorPrefix = method === 'CASH' ? 'cash' : 'etransfer'

  const previousState = snapshotApplicationAuditState(application)
  const newState = buildAuditStateFromUpdates(previousState, updates)

  const mutation = await mutateApplicationWithSecurityAudit(supabase, {
    applicationId: application.id,
    actorId,
    targetVendorId: application.vendor_id,
    actionType: SECURITY_AUDIT_ACTION.MANUAL_PAYMENT_CLEARANCE,
    previousState,
    newState,
    updates,
    ipAddress,
  })

  if (!mutation.ok) {
    return { ok: false, error: mutation.error ?? 'Update failed', status: 500 }
  }

  const { transactionId, error: txError } = await recordPlatformTransaction(supabase, {
    boothApplicationId: application.id,
    eventId: application.event_id,
    vendorId: application.vendor_id,
    coordinatorId: eventRow.coordinator_id,
    categoryId: application.category_id,
    totalAmountCents: boothPriceCents,
    platformFeeCents,
    feeModeUsed: feeConfig.mode,
    processorChargeId: `${processorPrefix}-${referenceCode}`,
    processorTransferId: null,
    status: 'completed',
    processor: 'offline',
  })

  if (txError) {
    console.error('[offline-payment] transaction record failed:', txError)
  }

  if (shouldAdvanceStatus) {
    try {
      const { sendSms } = await import('@/lib/twilio')
      const finalApprovedMessage =
        nextStatus === 'pending_insurance'
          ? '✅ Payment received! Upload your market insurance proof to finalize your approved booth.'
          : '✅ Payment received — your booth is approved! See you at the event.'

      await supabase.from('notifications').insert({
        user_id: application.vendor_id,
        type: 'application_approved',
        message: finalApprovedMessage,
        metadata: {
          application_id: application.id,
          event_id: application.event_id,
          payment_method: method,
          payment_cleared: true,
        },
      })

      const { data: vendorProfile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', application.vendor_id)
        .single()

      if (vendorProfile?.phone) {
        await sendSms(vendorProfile.phone, finalApprovedMessage)
      }
    } catch (notifyErr) {
      console.error('[offline-payment] auto-approval notification failed:', notifyErr)
    }
  }

  const vendor = Array.isArray(application.vendor) ? application.vendor[0] : application.vendor
  const passport = extractNestedPassport(application)

  if (vendor?.email && method === 'ETRANSFER') {
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

  return {
    ok: true,
    applicationId: application.id,
    status: nextStatus,
    advancedToApproved: shouldAdvanceStatus,
    transactionId,
    revenueAddedCents: boothPriceCents,
    platformFeeCents,
  }
}
