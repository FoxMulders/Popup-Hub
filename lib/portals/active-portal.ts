import type { Profile } from '@/types/database'
import { canAccessVendorPortal } from '@/lib/auth/rbac'

export type ActivePortal = 'markets' | 'vendor'

export const ACTIVE_PORTAL_COOKIE = 'active_portal'

export function parseActivePortal(value: string | undefined): ActivePortal | null {
  if (value === 'markets' || value === 'vendor') return value
  return null
}

export function resolveActivePortal(
  cookieValue: string | undefined,
  profile: Profile | null,
  approvalCount: number
): ActivePortal {
  const parsed = parseActivePortal(cookieValue)
  if (parsed === 'vendor' && canAccessVendorPortal(profile?.role ?? 'shopper', approvalCount)) {
    return 'vendor'
  }
  if (parsed === 'markets') return 'markets'

  if (canAccessVendorPortal(profile?.role ?? 'shopper', approvalCount)) return 'vendor'
  return 'markets'
}

export function getDefaultDashboard(
  role: string,
  approvalCount: number,
  activePortal?: ActivePortal | null
): string {
  if (role === 'coordinator') return '/coordinator/dashboard'
  if (canAccessVendorPortal(role as Profile['role'], approvalCount) && activePortal === 'vendor') {
    return '/vendor/dashboard'
  }
  if (canAccessVendorPortal(role as Profile['role'], approvalCount) && role === 'vendor') {
    return '/vendor/dashboard'
  }
  return '/discover'
}
