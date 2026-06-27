import { SITE_HOME_PATH } from '@/lib/nav/site-home'
import { COORDINATOR_HOME_PATH } from '@/lib/coordinator/coordinator-routes'

/** Portal landing routes — no back affordance. */
const PORTAL_HOME_PATHS = new Set([
  SITE_HOME_PATH,
  '/discover',
  '/vendor/dashboard',
  COORDINATOR_HOME_PATH,
])

const AUTH_PATHS = new Set(['/login', '/signup', '/confirm-email'])

const IMMERSIVE_PREFIXES = [
  '/coordinator/studio',
  '/coordinator/dashboard',
  '/api/',
]

export function isPageBackExcluded(pathname: string): boolean {
  if (!pathname || pathname === '/') return true
  if (PORTAL_HOME_PATHS.has(pathname)) return true
  if (AUTH_PATHS.has(pathname)) return true
  if (IMMERSIVE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true
  }
  if (/\/coordinator\/events\/[^/]+\/(layout|setup)\/?$/.test(pathname)) return true
  if (pathname === '/coordinator/events/new') return true
  return false
}

/** Parent route when history is empty (deep link / fresh tab). */
export function pageBackFallbackHref(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) return SITE_HOME_PATH

  if (segments[0] === 'vendor') {
    if (segments[1] === 'events' && segments[2]) {
      if (segments.length > 3) return `/vendor/events/${segments[2]}`
      return '/vendor/events'
    }
    return '/vendor/dashboard'
  }

  if (segments[0] === 'coordinator') {
    if (segments[1] === 'events' && segments[2]) {
      if (segments.length > 3) return `/coordinator/events/${segments[2]}`
      return COORDINATOR_HOME_PATH
    }
    if (segments[1] === 'markets') return COORDINATOR_HOME_PATH
    return COORDINATOR_HOME_PATH
  }

  if (segments[0] === 'events' && segments[1]) {
    if (segments.length > 2) return `/events/${segments[1]}`
    return '/discover'
  }

  if (segments[0] === 'organizers' && segments[1]) return '/check'
  if (segments[0] === 'check') {
    if (segments[1] === 'review') return '/check'
    return SITE_HOME_PATH
  }

  if (segments[0] === 'legal') return SITE_HOME_PATH
  if (segments[0] === 'wallet') return '/discover'
  if (segments[0] === 'profile') return '/discover'
  if (segments[0] === 'admin') return COORDINATOR_HOME_PATH

  if (segments.length > 1) {
    return `/${segments.slice(0, -1).join('/')}`
  }

  return SITE_HOME_PATH
}
