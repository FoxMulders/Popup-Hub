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
      return '/coordinator/dashboard'
    case 'vendor':
      return '/vendor/dashboard'
    case 'patron':
      return '/discover'
  }
}

/** Portals a user may switch between. Shoppers get none (no switcher). */
export function getAvailablePortals(role: Role | string | null | undefined): ActivePortal[] {
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
  portal: ActivePortal
): boolean {
  return getAvailablePortals(role).includes(portal)
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

export function resolveActivePortal(
  cookieValue: string | undefined,
  profile: Profile | null,
  pathname?: string
): ActivePortal {
  const role = profile?.role ?? 'shopper'
  const available = getAvailablePortals(role)
  const parsed = parseActivePortal(cookieValue)

  if (parsed && available.includes(parsed)) {
    return parsed
  }

  if (pathname) {
    const fromPath = detectPortalFromPath(pathname)
    if (fromPath === 'patron' || available.includes(fromPath)) {
      return fromPath
    }
  }

  return 'patron'
}

export function getDefaultDashboard(
  role: string,
  _approvalCount: number,
  activePortal?: ActivePortal | null
): string {
  const normalized = (role ?? 'shopper') as Role

  // Everyone lands on the patron discover page unless they have an explicit
  // active-portal cookie from a prior session switch.
  if (activePortal && canAccessPortal(normalized, activePortal)) {
    return getPortalHome(activePortal)
  }

  return getPortalHome('patron')
}
