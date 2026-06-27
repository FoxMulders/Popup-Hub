const DEFAULT_RETURN = '/coordinator/events/new'

export function parseGoogleOAuthState(state: string | null | undefined): {
  userId: string
  returnTo: string
} | null {
  const raw = state?.trim()
  if (!raw) return null
  const pipe = raw.indexOf('|')
  if (pipe < 0) return { userId: raw, returnTo: DEFAULT_RETURN }
  const userId = raw.slice(0, pipe).trim()
  const returnTo = decodeURIComponent(raw.slice(pipe + 1)).trim()
  if (!userId) return null
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return { userId, returnTo: DEFAULT_RETURN }
  }
  return { userId, returnTo }
}

export function buildGoogleOAuthState(userId: string, returnTo?: string | null): string {
  const safeReturn =
    returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//')
      ? returnTo
      : DEFAULT_RETURN
  return `${userId}|${encodeURIComponent(safeReturn)}`
}

export function googleOAuthReturnUrl(origin: string, returnTo: string, param: string): string {
  const url = new URL(returnTo, origin)
  url.searchParams.set('google_oauth', param)
  return url.toString()
}
