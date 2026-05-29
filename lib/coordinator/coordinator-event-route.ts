/** Event id from `/coordinator/events/[id]/…`, excluding `new`. */
export function coordinatorEventIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/coordinator\/events\/([^/]+)/)
  const id = match?.[1]
  if (!id || id === 'new') return null
  return id
}
