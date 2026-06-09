import { getURL } from '@/lib/url/public-app-url'

/** Build the Supabase OAuth return URL (must be allow-listed in Supabase Auth settings). */
export function buildOAuthCallbackUrl(
  origin: string,
  params?: Record<string, string | null | undefined>,
): string {
  const base = origin.replace(/\/$/, '')
  const search = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') search.set(key, value)
    }
  }
  const query = search.toString()
  return query ? `${base}/api/auth/callback?${query}` : `${base}/api/auth/callback`
}

/** Client-side origin for OAuth — prefer the live browser origin on any deployed domain. */
export function getOAuthOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return getURL()
}
