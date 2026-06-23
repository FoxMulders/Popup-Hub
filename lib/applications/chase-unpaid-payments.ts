import type { SupabaseClient } from '@supabase/supabase-js'
import { isApplicationAwaitingBoothPayment } from '@/lib/applications/payment-fields'
import { resolvePaymentDueAt } from '@/lib/applications/payment-deadline'
import { notifyVendorPaymentChase } from '@/lib/applications/notify-vendor-payment-chase'
import { resolveNextReminderStage } from '@/lib/applications/payment-reminder-schedule'
import { releaseUnpaidApplication, type UnpaidApplicationRow } from '@/lib/applications/release-unpaid-application'
import { resolveVendorDisplayName } from '@/lib/email/application-received'
import { computeApplicationBoothPriceCents } from '@/lib/monetization/booth-pricing'
import type {
  ApplicationPaymentStatus,
  ApplicationStatus,
  PaymentMethod,
  PaymentStatus,
} from '@/types/database'

type ChaseApplicationRow = {
  id: string
  vendor_id: string
  event_id: string
  category_id: string
  status: ApplicationStatus
  payment_status: PaymentStatus
  payment_method: PaymentMethod | null
  application_payment_status: ApplicationPaymentStatus | null
  payment_due_at: string | null
  payment_reminder_stage: number
  approved_at: string | null
  applied_at: string
  table_count: number | null
  booth_number: number | null
  vendor?: { full_name: string | null; email: string | null; phone?: string | null } | null
  passport?: { business_name: string | null } | null
  event?: {
    id: string
    name: string | null
    start_at: string
    payment_due_at: string | null
    coordinator_id: string
    listing_type: string | null
    booth_price_cents: number | null
    multi_table_discount_percent: number | null
  } | null
  category_limit?: { price_per_booth: number | null } | null
}

export type ChaseUnpaidPaymentsResult = {
  scanned: number
  backfilledDueDates: number
  remindersSent: number
  released: number
}

function anchorTimestamp(app: ChaseApplicationRow): string {
  return app.approved_at ?? app.applied_at
}

async function resolveAmountCents(
  supabase: SupabaseClient,
  app: ChaseApplicationRow
): Promise<number | null> {
  const event = Array.isArray(app.event) ? app.event[0] : app.event
  if (!event) return null

  let pricePerBooth = app.category_limit?.price_per_booth ?? null
  if (pricePerBooth == null) {
    const { data: limit } = await supabase
      .from('event_category_limits')
      .select('price_per_booth')
      .eq('event_id', app.event_id)
      .eq('category_id', app.category_id)
      .maybeSingle()
    pricePerBooth = limit?.price_per_booth ?? null
  }

  return computeApplicationBoothPriceCents(
    pricePerBooth,
    {
      listing_type: event.listing_type as 'community_market' | 'garage_yard_sale' | null,
      booth_price_cents: event.booth_price_cents,
      multi_table_discount_percent: event.multi_table_discount_percent,
    },
    app.table_count ?? 1
  )
}

export async function chaseUnpaidPayments(
  supabase: SupabaseClient,
  now: Date = new Date()
): Promise<ChaseUnpaidPaymentsResult> {
  const result: ChaseUnpaidPaymentsResult = {
    scanned: 0,
    backfilledDueDates: 0,
    remindersSent: 0,
    released: 0,
  }

  const { data: rows, error } = await supabase
    .from('booth_applications')
    .select(`
      id,
      vendor_id,
      event_id,
      category_id,
      status,
      payment_status,
      payment_method,
      application_payment_status,
      payment_due_at,
      payment_reminder_stage,
      approved_at,
      applied_at,
      table_count,
      booth_number,
      vendor:profiles!booth_applications_vendor_id_fkey(full_name, email, phone),
      passport:vendor_passports(business_name),
      event:events(id, name, start_at, payment_due_at, coordinator_id, listing_type, booth_price_cents, multi_table_discount_percent)
    `)
    .in('status', ['approved', 'pending_insurance', 'pending'])
    .or(
      'payment_status.eq.payment_required,and(status.eq.pending,application_payment_status.eq.PENDING_REVIEW)'
    )
    .limit(500)

  if (error) throw error

  for (const raw of rows ?? []) {
    const app = raw as unknown as ChaseApplicationRow
    if (!isApplicationAwaitingBoothPayment(app)) continue

    result.scanned += 1

    let paymentDueAt = app.payment_due_at
    const event = Array.isArray(app.event) ? app.event[0] : app.event

    if (!paymentDueAt && event?.start_at) {
      paymentDueAt = resolvePaymentDueAt({
        anchorAt: anchorTimestamp(app),
        eventStartAt: event.start_at,
        eventPaymentDueAt: event.payment_due_at,
        now,
      })
      await supabase
        .from('booth_applications')
        .update({ payment_due_at: paymentDueAt })
        .eq('id', app.id)
      result.backfilledDueDates += 1
    }

    if (!paymentDueAt) continue

    const msLeft = new Date(paymentDueAt).getTime() - now.getTime()

    if (msLeft <= 0) {
      const released = await releaseUnpaidApplication(
        supabase,
        app as unknown as UnpaidApplicationRow,
        now
      )
      if (released.released) result.released += 1
      continue
    }

    const next = resolveNextReminderStage(msLeft, app.payment_reminder_stage ?? 0)
    if (!next) continue

    const vendor = Array.isArray(app.vendor) ? app.vendor[0] : app.vendor
    const passport = Array.isArray(app.passport) ? app.passport[0] : app.passport
    const vendorName = resolveVendorDisplayName(passport ?? null, vendor ?? null)
    const amountCents = await resolveAmountCents(supabase, app)

    await notifyVendorPaymentChase({
      supabase,
      vendorId: app.vendor_id,
      vendorEmail: vendor?.email,
      vendorName,
      vendorPhone: vendor?.phone,
      applicationId: app.id,
      eventId: app.event_id,
      eventName: event?.name ?? 'your market',
      paymentDueAt,
      amountCents,
      kind: 'reminder',
      reminderStage: next.stage,
    })

    await supabase
      .from('booth_applications')
      .update({
        payment_reminder_stage: next.stage,
        last_payment_reminder_at: now.toISOString(),
      })
      .eq('id', app.id)

    result.remindersSent += 1
  }

  return result
}
