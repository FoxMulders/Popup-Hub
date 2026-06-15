import { getDefaultDashboard, parseActivePortal, type ActivePortal } from '@/lib/portals/active-portal'
import { isMobileUserAgent } from '@/lib/auth/mobile-user-agent'

function safeRedirectPath(value: string | null | undefined, fallback = '/discover'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }
  return value
}

function isCoordinatorLayoutPath(path: string): boolean {
  return /\/coordinator\/events\/[^/]+\/layout\/?$/.test(path)
}

/**
 * Post-auth landing path — coordinators on phones skip the layout canvas
 * and land on the lightweight dashboard overview.
 */
export function resolvePostLoginPath(input: {
  role: string | null | undefined
  redirectTo?: string | null
  userAgent?: string | null
  activePortal?: ActivePortal | null
  isAdmin?: boolean
}): string {
  const role = input.role ?? 'shopper'
  const redirectTo = safeRedirectPath(input.redirectTo)
  const mobile = isMobileUserAgent(input.userAgent)

  if (mobile && isCoordinatorLayoutPath(redirectTo)) {
    return '/coordinator/markets'
  }

  if (role === 'coordinator' && mobile) {
    if (redirectTo.startsWith('/coordinator') && !isCoordinatorLayoutPath(redirectTo)) {
      return redirectTo
    }
    return '/coordinator'
  }

  if (role === 'coordinator') {
    return redirectTo.startsWith('/coordinator') ? redirectTo : '/coordinator'
  }

  if (role === 'vendor') {
    return redirectTo.startsWith('/vendor') ? redirectTo : '/vendor/dashboard'
  }

  if (input.activePortal) {
    return getDefaultDashboard(role, 0, input.activePortal, { isAdmin: input.isAdmin })
  }

  return redirectTo
}
