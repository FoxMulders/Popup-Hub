import { getDefaultDashboard, parseActivePortal, type ActivePortal } from '@/lib/portals/active-portal'
import { isMobileUserAgent } from '@/lib/auth/mobile-user-agent'

function safeRedirectPath(value: string | null | undefined, fallback = '/discover'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }
  return value
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

  if (role === 'coordinator' && mobile) {
    return '/coordinator/dashboard?overview=mobile'
  }

  if (role === 'coordinator') {
    return '/coordinator/dashboard'
  }

  if (role === 'vendor') {
    return '/vendor/dashboard'
  }

  if (input.activePortal) {
    return getDefaultDashboard(role, 0, input.activePortal, { isAdmin: input.isAdmin })
  }

  return redirectTo
}
