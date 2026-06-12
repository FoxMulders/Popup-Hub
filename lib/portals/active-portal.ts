import type { Profile, Role } from '@/types/database'

export type ActivePortal = 'patron' | 'vendor' | 'coordinator'

export const ACTIVE_PORTAL_COOKIE = 'active_portal'

export const PORTAL_LABELS: Record<ActivePortal, string> = {
  patron: 'Patron',
  vendor: 'Vendor',
  coordinator: 'Coordinator',
}

export function getPortalHome(portal: ActivePortal): string {
  switch (portal) {
    case 'coordinator':
      return '/coordinator'
    case 'vendor':
      return '/vendor/dashboard'
    case 'patron':
      return '/discover'
  }
}

/** Portals a user may switch between. Shoppers get none (no switcher). */
export function getAvailablePortals(
  role: Role | string | null | undefined,
  options?: { isAdmin?: boolean }
): ActivePortal[] {
  if (options?.isAdmin) {
    return ['patron', 'vendor', 'coordinator']
  }

  const normalized = (role ?? 'shopper') as Role
  if (normalized === 'coordinator') {
    return ['patron', 'vendor', 'coordinator']
  }
  if (normalized === 'vendor') {
    return ['patron', 'vendor']
  }
  return []
}

export function canAccessPortal(
  role: Role | string | null | undefined,
  portal: ActivePortal,
  options?: { isAdmin?: boolean }
): boolean {
  return getAvailablePortals(role, options).includes(portal)
}

export function parseActivePortal(value: string | undefined): ActivePortal | null {
  if (value === 'patron' || value === 'vendor' || value === 'coordinator') {
    return value
  }
  // Legacy cookie value
  if (value === 'markets') return 'patron'
  return null
}

export function detectPortalFromPath(pathname: string): ActivePortal {
  if (pathname.startsWith('/coordinator')) return 'coordinator'
  if (pathname.startsWith('/vendor')) return 'vendor'
  return 'patron'
}

/** Browse/shopper routes where nav chrome should reflect Patron regardless of cookie. */
const PATRON_PORTAL_PATH_PREFIXES = [
  '/discover',
  '/favorites',
  '/supplies',
  '/events/',
  '/auctions/',
] as const

export function isPatronPortalPath(pathname: string): boolean {
  return PATRON_PORTAL_PATH_PREFIXES.some((prefix) =>
    prefix.endsWith('/')
      ? pathname.startsWith(prefix)
      : pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

/** Portal implied by a route prefix when the signed-in account may access it. */
export function portalFromAccessiblePath(
  pathname: string,
  role: Role | string | null | undefined,
  options?: { isAdmin?: boolean }
): ActivePortal | null {
  const fromPath = detectPortalFromPath(pathname)
  if (fromPath === 'patron') return null
  if (canAccessPortal(role, fromPath, options)) return fromPath
  return null
}

export function resolveActivePortal(
  cookieValue: string | undefined,
  profile: Profile | null,
  pathname?: string
): ActivePortal {
  const role = profile?.role ?? 'shopper'
  const portalOptions = { isAdmin: profile?.is_admin === true }
  const available = getAvailablePortals(role, portalOptions)
  const parsed = parseActivePortal(cookieValue)

  // Route wins over cookie so nav chrome matches the URL.
  if (pathname) {
    const fromAccessiblePath = portalFromAccessiblePath(pathname, role, portalOptions)
    if (fromAccessiblePath) return fromAccessiblePath

    if (isPatronPortalPath(pathname)) {
      if (available.includes('patron') || available.length === 0) {
        return 'patron'
      }
    }

    const fromPath = detectPortalFromPath(pathname)
    if (fromPath !== 'patron' && available.includes(fromPath)) {
      return fromPath
    }
  }

  if (parsed && available.includes(parsed)) {
    return parsed
  }

  return 'patron'
}

export function getDefaultDashboard(
  role: string,
  _approvalCount: number,
  activePortal?: ActivePortal | null,
  options?: { isAdmin?: boolean }
): string {
  const normalized = (role ?? 'shopper') as Role

  // Everyone lands on the patron discover page unless they have an explicit
  // active-portal cookie from a prior session switch.
  if (activePortal && canAccessPortal(normalized, activePortal, options)) {
    return getPortalHome(activePortal)
  }

  return getPortalHome('patron')
}
