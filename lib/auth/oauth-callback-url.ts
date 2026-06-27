import { getURL } from '@/lib/url/public-app-url'

/** Custom-scheme callback registered in Supabase + Android/iOS deep links. */
export const NATIVE_OAUTH_CALLBACK_URL = 'ca.popuphub.app://auth/callback'

/** Build native deep-link OAuth return URL (no /api prefix — mapped in CapacitorInit). */
export function buildNativeOAuthCallbackUrl(
  params?: Record<string, string | null | undefined>,
): string {
  const search = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== '') search.set(key, value)
    }
  }
  const query = search.toString()
  return query ? `${NATIVE_OAUTH_CALLBACK_URL}?${query}` : NATIVE_OAUTH_CALLBACK_URL
}

/** Relative path for PKCE code exchange — must use full navigation (not router.push) so Set-Cookie persists. */
export function apiAuthCallbackHref(searchParams?: URLSearchParams | string): string {
  if (!searchParams) return '/api/auth/callback'
  const query =
    typeof searchParams === 'string' ? searchParams : searchParams.toString()
  return query ? `/api/auth/callback?${query}` : '/api/auth/callback'
}

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
