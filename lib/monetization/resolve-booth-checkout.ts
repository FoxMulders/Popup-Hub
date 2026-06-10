import type { SupabaseClient } from '@supabase/supabase-js'
import { loadCoordinatorEscrowContext } from '@/lib/coordinator/escrow'
import { computeBoothCheckoutBreakdown } from '@/lib/monetization/booth-checkout'
import { computeApplicationBoothPriceCents } from '@/lib/monetization/booth-pricing'
import { resolveEventFeeConfig } from '@/lib/monetization/fee-config'
import type { EventListingType, PlatformFeeMode } from '@/types/database'

type EventFeeRow = {
  listing_type?: EventListingType | string | null
  booth_price_cents?: number | null
  multi_table_discount_percent?: number | null
  platform_fee_mode?: PlatformFeeMode | null
  platform_fee_flat_cents?: number | null
  platform_fee_bps?: number | null
  pass_fees_to_vendor?: boolean | null
  coordinator_id?: string | null
}

export async function resolveBoothCheckoutForApplication(
  supabase: SupabaseClient,
  params: {
    baseBoothCents: number
    eventRow: EventFeeRow | null | undefined
    coordinatorId: string
  }
) {
  const feeConfig = resolveEventFeeConfig(params.eventRow)
  const { escrowExempt } = await loadCoordinatorEscrowContext(supabase, params.coordinatorId)

  return computeBoothCheckoutBreakdown({
    baseBoothCents: params.baseBoothCents,
    feeConfig,
    passFeesToVendor: params.eventRow?.pass_fees_to_vendor === true,
    coordinatorIsVerified: escrowExempt,
  })
}

export async function resolveBoothCheckoutFromApplication(
  supabase: SupabaseClient,
  params: {
    pricePerBooth: number | undefined
    tableCount: number
    eventRow: EventFeeRow | null | undefined
    coordinatorId: string
  }
) {
  const baseBoothCents = computeApplicationBoothPriceCents(
    params.pricePerBooth,
    {
      listing_type: params.eventRow?.listing_type as EventListingType | undefined,
      booth_price_cents: params.eventRow?.booth_price_cents ?? undefined,
      multi_table_discount_percent: params.eventRow?.multi_table_discount_percent ?? undefined,
    },
    params.tableCount
  )

  return resolveBoothCheckoutForApplication(supabase, {
    baseBoothCents,
    eventRow: params.eventRow,
    coordinatorId: params.coordinatorId,
  })
}
