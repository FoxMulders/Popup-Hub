import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'
import { isQuarterAuctionListing } from '@/lib/events/listing-type'
import type { EventListingType } from '@/types/database'

/** Quarter auctions (garage_yard_sale) — multi-table market discount does not apply. */
export function isCommunityMarketListing(
  listingType: EventListingType | null | undefined
): boolean {
  return !isQuarterAuctionListing(listingType)
}

/** Apply one event-wide booth/table fee to every category cap row. */
export function applyUnifiedBoothFeeToCategoryLimits(
  limits: CategoryLimit[],
  boothPriceCents: number
): CategoryLimit[] {
  const cents = Math.max(0, Math.round(boothPriceCents))
  return limits.map((limit) => ({ ...limit, pricePerBooth: cents }))
}

export function resolveBoothUnitPriceCents(
  categoryPricePerBooth: number | null | undefined,
  eventBoothPriceCents: number | null | undefined
): number {
  const category = categoryPricePerBooth ?? 0
  if (category > 0) return category
  return Math.max(0, eventBoothPriceCents ?? 0)
}

export function computeBoothCheckoutCents(params: {
  unitPriceCents: number
  tableCount: number
  multiTableDiscountPercent: number
  applyMultiTableDiscount: boolean
}): number {
  const tables = Math.max(1, Math.floor(params.tableCount))
  const unit = Math.max(0, params.unitPriceCents)
  const subtotal = unit * tables

  if (
    !params.applyMultiTableDiscount ||
    tables < 2 ||
    params.multiTableDiscountPercent <= 0
  ) {
    return subtotal
  }

  const pct = Math.min(100, Math.max(0, Math.round(params.multiTableDiscountPercent)))
  const discount = Math.round((subtotal * pct) / 100)
  return Math.max(0, subtotal - discount)
}

export type BoothPricingEventFields = {
  listing_type?: EventListingType | null
  booth_price_cents?: number | null
  multi_table_discount_percent?: number | null
}

export function computeApplicationBoothPriceCents(
  categoryPricePerBooth: number | null | undefined,
  event: BoothPricingEventFields,
  tableCount: number
): number {
  const unit = resolveBoothUnitPriceCents(
    categoryPricePerBooth,
    event.booth_price_cents
  )
  return computeBoothCheckoutCents({
    unitPriceCents: unit,
    tableCount,
    multiTableDiscountPercent: event.multi_table_discount_percent ?? 0,
    applyMultiTableDiscount: isCommunityMarketListing(event.listing_type),
  })
}

export function normalizeTableCount(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(20, Math.floor(n))
}
