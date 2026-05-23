import type { Role } from '@/types/database'

/** Hierarchical permission levels (higher includes lower). */
export const ROLE_LEVEL = {
  shopper: 1,
  vendor: 2,
  coordinator: 3,
} as const satisfies Record<Role, number>

export type SignupRole = Role

export const SIGNUP_ROLES: readonly SignupRole[] = ['shopper', 'vendor', 'coordinator'] as const

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

export function normalizeRole(role: string | null | undefined): Role {
  if (role === 'coordinator' || role === 'vendor' || role === 'shopper') {
    return role
  }
  return 'shopper'
}

export function roleLevel(role: string | null | undefined): number {
  return ROLE_LEVEL[normalizeRole(role)]
}

/** True when the user's role tier meets or exceeds the required tier. */
export function hasAccess(
  userRole: string | null | undefined,
  requiredRole: Role
): boolean {
  return roleLevel(userRole) >= ROLE_LEVEL[requiredRole]
}

export function isVendorRole(role: string | null | undefined): role is 'vendor' {
  return role === 'vendor'
}

export function isShopperRole(role: string | null | undefined): role is 'shopper' {
  return role === 'shopper' || role == null
}

export function isCoordinatorRole(role: string | null | undefined): role is 'coordinator' {
  return role === 'coordinator'
}

/** Minimum role tier required to access a route, or null when open to all signed-in users. */
export function minimumRoleForPath(pathname: string): Role | null {
  if (pathname.startsWith('/coordinator')) return 'coordinator'

  if (SHOPPER_ALLOWED_VENDOR_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null
  }

  if (pathname.startsWith('/vendor')) return 'vendor'
  if (APPLICATION_FUNNEL_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return 'vendor'
  }

  return null
}

export function isPathAccessAllowed(
  pathname: string,
  userRole: string | null | undefined
): boolean {
  const requiredRole = minimumRoleForPath(pathname)
  if (!requiredRole) return true
  return hasAccess(userRole, requiredRole)
}

/** @deprecated Prefer minimumRoleForPath + hasAccess. */
export function isShopperBlockedPath(pathname: string): boolean {
  return minimumRoleForPath(pathname) === 'vendor'
}

/** Redirect target when a user lacks the required role tier for a route. */
export const SHOPPER_BLOCKED_REDIRECT = '/discover'

export function accessDeniedRedirect(userRole: string | null | undefined): string {
  if (hasAccess(userRole, 'coordinator')) return '/coordinator/dashboard'
  if (hasAccess(userRole, 'vendor')) return '/vendor/dashboard'
  return SHOPPER_BLOCKED_REDIRECT
}

export function canAccessVendorPortal(role: Role, _approvalCount = 0): boolean {
  return hasAccess(role, 'vendor')
}

export function canSubmitMarketApplication(role: Role): boolean {
  return hasAccess(role, 'vendor')
}

export function canRequestVendorAccess(role: Role): boolean {
  return hasAccess(role, 'vendor')
}
