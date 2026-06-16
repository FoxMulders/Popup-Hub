import type { Role } from '@/types/database'
import { COORDINATOR_MARKETS_PATH, COORDINATOR_STUDIO_PATH } from '@/lib/coordinator/coordinator-routes'
import { getAvailablePortals, PORTAL_LABELS, type ActivePortal } from '@/lib/portals/active-portal'
import { hasAccess, isPlatformAdmin, normalizeRole, type AccessProfile } from '@/lib/auth/rbac'

export interface AccountCapability {
  id: string
  label: string
  description: string
  requiredRole: Role
  href?: string
}

export const ACCOUNT_CAPABILITIES: AccountCapability[] = [
  {
    id: 'discover',
    label: 'Discover markets',
    description: 'Discover public market listings and maps',
    requiredRole: 'shopper',
    href: '/discover',
  },
  {
    id: 'favorites',
    label: 'Save favorite markets',
    description: 'Bookmark events from the patron portal',
    requiredRole: 'shopper',
    href: '/favorites',
  },
  {
    id: 'apply',
    label: 'Apply for booth space',
    description: 'Submit vendor applications to open markets',
    requiredRole: 'vendor',
    href: '/vendor/events',
  },
  {
    id: 'track_applications',
    label: 'Track your applications',
    description: 'See juried review status and follow up with organizers',
    requiredRole: 'vendor',
    href: '/vendor/applications',
  },
  {
    id: 'create_events',
    label: 'Create and publish markets',
    description: 'Set up events, categories, booth fees, and schedules',
    requiredRole: 'coordinator',
    href: '/coordinator/events/new',
  },
  {
    id: 'review_applications',
    label: 'Review vendor applications',
    description: 'Approve, decline, or waitlist juried booth applications',
    requiredRole: 'coordinator',
    href: COORDINATOR_MARKETS_PATH,
  },
  {
    id: 'manage_layout',
    label: 'Manage booth layout & market day ops',
    description: 'Blueprint Studio, check-in, and live operations',
    requiredRole: 'coordinator',
    href: COORDINATOR_STUDIO_PATH,
  },
  {
    id: 'square_payouts',
    label: 'Connect Square & receive booth payouts',
    description: 'OAuth Square account for paid booth checkout',
    requiredRole: 'coordinator',
    href: '/coordinator/payment-methods',
  },
]

export function roleDisplayLabel(role: Role): string {
  switch (role) {
    case 'coordinator':
      return 'Market Organizer (Coordinator)'
    case 'vendor':
      return 'Vendor'
    case 'shopper':
      return 'Patron'
    default:
      return role
  }
}

export function roleSummary(role: Role): string {
  switch (role) {
    case 'coordinator':
      return 'You can create markets, review juried vendor applications, and run market day tools. You also have patron and vendor portal views.'
    case 'vendor':
      return 'You can apply to open markets and manage your vendor passport. Juried events review your booth application; instant-book events approve on apply.'
    case 'shopper':
      return 'You can discover markets as a patron. Enable vendor access anytime to apply for booths — no organizer pre-approval required.'
    default:
      return ''
  }
}

export function resolveCapabilityAccess(profile: AccessProfile | string | null | undefined) {
  if (typeof profile === 'string' || profile == null) {
    const normalized = normalizeRole(profile)
    return ACCOUNT_CAPABILITIES.map((capability) => ({
      capability,
      enabled: hasAccess(normalized, capability.requiredRole),
    }))
  }

  if (isPlatformAdmin(profile)) {
    return ACCOUNT_CAPABILITIES.map((capability) => ({
      capability,
      enabled: true,
    }))
  }

  const normalized = normalizeRole(profile.role)
  return ACCOUNT_CAPABILITIES.map((capability) => ({
    capability,
    enabled: hasAccess(normalized, capability.requiredRole),
  }))
}

export function availablePortalLabels(
  profile: AccessProfile | string | null | undefined
): ActivePortal[] {
  if (typeof profile === 'string' || profile == null) {
    return getAvailablePortals(normalizeRole(profile))
  }

  return getAvailablePortals(profile.role, { isAdmin: profile.is_admin === true })
}

export function portalLabelsText(portals: ActivePortal[]): string {
  if (portals.length === 0) {
    return 'Patron only'
  }
  return portals.map((portal) => PORTAL_LABELS[portal]).join(' · ')
}

export function canSelfEnableCoordinator(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'shopper'
}

export function canSelfEnableVendor(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'shopper'
}
