import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildEtransferInstructionContextFromEvent,
  sendEtransferInstructionEmail,
} from '@/lib/email/etransfer-instructions'
import { resolveCoordinatorEtransferEmail } from '@/lib/coordinator/etransfer-email'
import {
  etransferHoldExpiresAt,
  generateEtransferReferenceCode,
} from '@/lib/applications/etransfer-reference'
import { resolveVendorDisplayName } from '@/lib/email/application-received'
import type { Event } from '@/types/database'

export interface DispatchEtransferInstructionsParams {
  applicationId: string
  eventId: string
  vendorId: string
  boothPriceCents: number
  referenceCode?: string | null
  expiresAt?: string | null
}

/**
 * Generates hold metadata if missing, persists it, and emails e-transfer instructions to the vendor.
 */
export async function dispatchEtransferInstructions(
  supabase: SupabaseClient,
  params: DispatchEtransferInstructionsParams
): Promise<{ ok: boolean; referenceCode?: string; expiresAt?: string; error?: string }> {
  const referenceCode = params.referenceCode?.trim() || generateEtransferReferenceCode()

  const [{ data: application }, { data: event }, { data: vendorProfile }, { data: passport }] =
    await Promise.all([
      supabase
        .from('booth_applications')
        .select('id, etransfer_reference_code, etransfer_expires_at, payment_due_at')
        .eq('id', params.applicationId)
        .single(),
      supabase
        .from('events')
        .select(
          'id, name, start_at, end_at, is_multi_day, event_days(id, event_id, date, start_time, end_time, sort_order), coordinator:profiles!events_coordinator_id_fkey(full_name, email, etransfer_payment_email)'
        )
        .eq('id', params.eventId)
        .single(),
      supabase.from('profiles').select('full_name, email').eq('id', params.vendorId).single(),
      supabase
        .from('vendor_passports')
        .select('business_name')
        .eq('user_id', params.vendorId)
        .maybeSingle(),
    ])

  if (!application || !event) {
    return { ok: false, error: 'Application or event not found' }
  }

  const expiresAt =
    params.expiresAt ??
    application.payment_due_at ??
    application.etransfer_expires_at ??
    etransferHoldExpiresAt()

  const storedReference = application.etransfer_reference_code ?? referenceCode
  const storedExpiry = application.etransfer_expires_at ?? expiresAt

  if (!application.etransfer_reference_code || !application.etransfer_expires_at) {
    await supabase
      .from('booth_applications')
      .update({
        etransfer_reference_code: storedReference,
        etransfer_expires_at: storedExpiry,
      })
      .eq('id', params.applicationId)
  }

  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator
  const coordinatorPaymentEmail = resolveCoordinatorEtransferEmail(coordinator)
  if (!coordinatorPaymentEmail) {
    return { ok: false, error: 'Coordinator payment email not configured' }
  }

  const vendorEmail = vendorProfile?.email?.trim()
  if (!vendorEmail) {
    return { ok: false, error: 'Vendor email not found' }
  }

  const emailCtx = buildEtransferInstructionContextFromEvent({
    vendorEmail,
    vendorName: resolveVendorDisplayName(passport, vendorProfile),
    totalAmountCents: params.boothPriceCents,
    referenceCode: storedReference,
    expiresAt: storedExpiry,
    coordinatorPaymentEmail,
    coordinatorName: coordinator?.full_name ?? null,
    event: event as Pick<Event, 'name' | 'start_at' | 'end_at' | 'is_multi_day' | 'event_days'>,
  })

  const result = await sendEtransferInstructionEmail(emailCtx)
  if (!result.ok && !result.skipped) {
    return { ok: false, error: result.error ?? 'Email send failed' }
  }

  return {
    ok: true,
    referenceCode: storedReference,
    expiresAt: storedExpiry,
  }
}
