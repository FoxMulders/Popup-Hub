/** Coordinator home landing (`/coordinator`). */
export const COORDINATOR_HOME_PATH = '/coordinator'

/** All-markets list — browse hubs, payments, and studio entry points. */
export const COORDINATOR_MARKETS_PATH = '/coordinator/markets'

/** Blueprint Studio — full-screen floor plan + allocation ledger workspace. */
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

export function coordinatorStudioLedgerHref(searchParams?: Record<string, string>): string {
  if (!searchParams || Object.keys(searchParams).length === 0) {
    return COORDINATOR_STUDIO_LEDGER_PATH
  }
  const params = new URLSearchParams(searchParams)
  return `${COORDINATOR_STUDIO_LEDGER_PATH}?${params.toString()}`
}
