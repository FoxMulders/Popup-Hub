/** Event id from `/coordinator/events/[id]/…`, excluding `new`. */
export function coordinatorEventIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/coordinator\/events\/([^/]+)/)
  const id = match?.[1]
  if (!id || id === 'new') return null
  return id
}

/**
 * Logo / back navigation for coordinator chrome: return to the active
 * event hub when the user is inside an event route, otherwise command center.
 */
export function coordinatorNavBackHref(pathname: string): string {
  const eventId = coordinatorEventIdFromPath(pathname)
  if (eventId) return `/coordinator/events/${eventId}`
  return '/coordinator/dashboard'
}
