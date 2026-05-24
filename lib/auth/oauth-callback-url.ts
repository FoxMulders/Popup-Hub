import { resolvePublicAppOrigin } from '@/lib/url/public-app-url'

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

/** Client-side origin for OAuth — prefer live browser origin on the deployed domain. */
export function getOAuthOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const { origin, hostname } = window.location
    if (hostname === 'popup-hub.vercel.app' || hostname.endsWith('.vercel.app')) {
      return origin
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return origin
    }
  }

  return resolvePublicAppOrigin()
}
