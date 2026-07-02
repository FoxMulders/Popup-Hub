/** Coordinator home landing (`/coordinator`). */
export const COORDINATOR_HOME_PATH = '/coordinator'

/** Post-login conversion gate — advertise vs native funnel (mobile-safe). */
export const COORDINATOR_WELCOME_PATH = '/coordinator/welcome'

/** Slim advertise-only market creation. */
export const COORDINATOR_ADVERTISE_PATH = '/coordinator/events/advertise'

/** All-markets list — browse hubs, payments, and studio entry points. */
export const COORDINATOR_MARKETS_PATH = '/coordinator/markets'

/** HubGrid — full-screen floor plan + allocation ledger workspace. */
export const COORDINATOR_STUDIO_PATH = '/coordinator/studio'

/** Dual-screen booth matrix window (presenter / wall cast). */
export const COORDINATOR_STUDIO_LEDGER_PATH = '/coordinator/studio/ledger'

export function isCoordinatorStudioPath(pathname: string): boolean {
  return (
    pathname === COORDINATOR_STUDIO_PATH || pathname.startsWith(`${COORDINATOR_STUDIO_PATH}/`)
  )
}

/** @deprecated Legacy URL — redirects to {@link COORDINATOR_STUDIO_PATH}. */
export function isLegacyCoordinatorDashboardPath(pathname: string): boolean {
  return (
    pathname === '/coordinator/dashboard' || pathname.startsWith('/coordinator/dashboard/')
  )
}

export function isCoordinatorStudioOrLegacyDashboardPath(pathname: string): boolean {
  return isCoordinatorStudioPath(pathname) || isLegacyCoordinatorDashboardPath(pathname)
}

export function coordinatorStudioHref(eventId?: string | null): string {
  if (!eventId) return COORDINATOR_STUDIO_PATH
  return `${COORDINATOR_STUDIO_PATH}?event=${encodeURIComponent(eventId)}`
}

/** HubGrid nav target — on mobile without an event, land on markets picker (avoids redirect loop). */
export function coordinatorHubGridNavHref(options?: {
  mobile?: boolean
  eventId?: string | null
}): string {
  const { mobile = false, eventId } = options ?? {}
  if (eventId) return coordinatorStudioHref(eventId)
  if (mobile) return COORDINATOR_MARKETS_PATH
  return COORDINATOR_STUDIO_PATH
}

export function coordinatorStudioLedgerHref(searchParams?: Record<string, string>): string {
  if (!searchParams || Object.keys(searchParams).length === 0) {
    return COORDINATOR_STUDIO_LEDGER_PATH
  }
  const params = new URLSearchParams(searchParams)
  return `${COORDINATOR_STUDIO_LEDGER_PATH}?${params.toString()}`
}
