import type { SupabaseClient } from '@supabase/supabase-js'
import { computeApplicationBoothPriceCents } from '@/lib/monetization/booth-pricing'
import { isApplicationAwaitingBoothPayment } from '@/lib/applications/payment-fields'
import type { BoothApplication, EventCategoryLimit } from '@/types/database'

export type OutstandingPaymentApplication = BoothApplication & {
  vendor?: { full_name: string | null; email: string | null } | null
  category?: { name: string } | null
  booth_price_cents: number
}

export type EventOutstandingPayments = {
  digital: OutstandingPaymentApplication[]
  offline: OutstandingPaymentApplication[]
  overdueCount: number
}

export async function fetchEventOutstandingPayments(
  supabase: SupabaseClient,
  eventId: string,
  categoryLimits: EventCategoryLimit[],
  eventPricing: {
    listing_type?: string | null
    booth_price_cents?: number | null
    multi_table_discount_percent?: number | null
  },
  now: Date = new Date()
): Promise<EventOutstandingPayments> {
  const { data: rows } = await supabase
    .from('booth_applications')
    .select(`
      *,
      vendor:profiles!booth_applications_vendor_id_fkey(full_name, email),
      category:categories(name)
    `)
    .eq('event_id', eventId)
    .in('status', ['approved', 'pending_insurance', 'pending'])

  const priceByCategory = new Map(
    categoryLimits.map((row) => [row.category_id, row.price_per_booth])
  )

  const digital: OutstandingPaymentApplication[] = []
  const offline: OutstandingPaymentApplication[] = []
  let overdueCount = 0

  for (const raw of rows ?? []) {
    const app = raw as BoothApplication
    if (!isApplicationAwaitingBoothPayment(app)) continue

    const boothPriceCents = computeApplicationBoothPriceCents(
      priceByCategory.get(app.category_id) ?? null,
      {
        listing_type: eventPricing.listing_type as 'community_market' | 'garage_yard_sale' | null,
        booth_price_cents: eventPricing.booth_price_cents ?? null,
        multi_table_discount_percent: eventPricing.multi_table_discount_percent ?? null,
      },
      app.table_count ?? 1
    )

    if (boothPriceCents <= 0) continue

    const enriched = {
      ...app,
      booth_price_cents: boothPriceCents,
    } as OutstandingPaymentApplication

    if (app.payment_status === 'payment_required') {
      digital.push(enriched)
    } else {
      offline.push(enriched)
    }

    if (app.payment_due_at && new Date(app.payment_due_at).getTime() <= now.getTime()) {
      overdueCount += 1
    }
  }

  digital.sort((a, b) => {
    const aDue = a.payment_due_at ? new Date(a.payment_due_at).getTime() : Infinity
    const bDue = b.payment_due_at ? new Date(b.payment_due_at).getTime() : Infinity
    return aDue - bDue
  })
  offline.sort((a, b) => {
    const aDue = a.payment_due_at ? new Date(a.payment_due_at).getTime() : Infinity
    const bDue = b.payment_due_at ? new Date(b.payment_due_at).getTime() : Infinity
    return aDue - bDue
  })

  return { digital, offline, overdueCount }
}
