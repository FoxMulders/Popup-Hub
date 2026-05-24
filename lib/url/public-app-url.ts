const PRODUCTION_APP_URL = 'https://popup-hub.vercel.app'

function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) return null
  const trimmed = value.trim().replace(/\/$/, '')
  return trimmed || null
}

/** Resolved public app origin for OAuth, emails, and webhooks. */
export function resolvePublicAppOrigin(): string {
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL)
  if (configured) return configured

  const vercelHost =
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL
  const vercelOrigin = normalizeOrigin(
    vercelHost ? (vercelHost.startsWith('http') ? vercelHost : `https://${vercelHost}`) : null,
  )
  if (vercelOrigin) return vercelOrigin

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_APP_URL
  }

  return 'http://localhost:3000'
}

/** Absolute public URL when origin is known; otherwise a stable relative path. */
export function publicAppUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${resolvePublicAppOrigin()}${normalizedPath}`
}
