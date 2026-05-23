import type { Role } from '@/types/database'

/** Vendor portal paths allowed before role promotion (invitation acceptance). */
export const SHOPPER_ALLOWED_VENDOR_PREFIXES = ['/vendor/activate'] as const

/** Vendor-only route prefixes blocked for shopper accounts. */
export const VENDOR_ONLY_PREFIXES = [
  '/vendor/dashboard',
  '/vendor/events',
  '/vendor/applications',
  '/vendor/passport',
  '/profile/passport',
] as const

/** Application funnel paths blocked for shoppers (legacy + canonical). */
export const APPLICATION_FUNNEL_PATTERNS = [
  /^\/vendor(?:\/|$)/,
  /^\/events\/[^/]+\/apply(?:\/|$)/,
  /^\/markets\/[^/]+\/apply(?:\/|$)/,
] as const

export function isVendorRole(role: string | null | undefined): role is 'vendor' {
  return role === 'vendor'
}

export function isShopperRole(role: string | null | undefined): role is 'shopper' {
  return role === 'shopper' || role == null
}

export function isCoordinatorRole(role: string | null | undefined): role is 'coordinator' {
  return role === 'coordinator'
}

/** Returns true when a shopper account must not access this path. */
export function isShopperBlockedPath(pathname: string): boolean {
  if (SHOPPER_ALLOWED_VENDOR_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false
  }

  return APPLICATION_FUNNEL_PATTERNS.some((pattern) => pattern.test(pathname))
}

/** Redirect target when a shopper hits a vendor/application route. */
export const SHOPPER_BLOCKED_REDIRECT = '/'

export function canAccessVendorPortal(role: Role, approvalCount: number): boolean {
  return role === 'vendor' && approvalCount > 0
}

export function canSubmitMarketApplication(role: Role): boolean {
  return role === 'vendor'
}

export function canRequestVendorAccess(role: Role): boolean {
  return role === 'vendor'
}
