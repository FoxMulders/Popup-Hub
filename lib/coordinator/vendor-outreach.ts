import { publicAppUrl } from '@/lib/url/public-app-url'

/** Vendor portal page where makers review market details and apply for a booth. */
export function vendorMarketApplyPath(eventId: string): string {
  return `/vendor/events/${eventId}`
}

/**
 * Single shareable link for coordinators — vendor signup that lands on the market apply page.
 * Example: /signup?role=vendor&next=%2Fvendor%2Fevents%2F{eventId}
 */
export function vendorMarketInviteUrl(eventId: string, origin?: string): string {
  const next = encodeURIComponent(vendorMarketApplyPath(eventId))
  return publicAppUrl(`/signup?role=vendor&next=${next}`, origin)
}

/** @deprecated Prefer vendorMarketInviteUrl for coordinator outreach. */
export function vendorSignupUrl(origin?: string): string {
  return publicAppUrl('/signup?role=vendor', origin)
}

/** Public patron-facing market listing (discover / share with shoppers). */
export function marketListingUrl(eventId: string, origin?: string): string {
  return publicAppUrl(`/events/${eventId}`, origin)
}

export function isMarketPublishedForVendors(status: string): boolean {
  return status !== 'draft' && status !== 'cancelled'
}
