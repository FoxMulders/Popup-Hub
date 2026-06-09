function normalizeSiteUrl(value: string): string {
  let url = value.trim()
  url = url.includes('http') ? url : `https://${url}`
  url = url.endsWith('/') ? url.slice(0, -1) : url
  return url
}

/** Canonical public origin for OAuth, emails, redirects, and metadata. */
export function getURL(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL

  if (configured?.trim()) {
    return normalizeSiteUrl(configured)
  }

  const vercelHost =
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL

  if (vercelHost?.trim()) {
    return normalizeSiteUrl(vercelHost)
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  return 'http://localhost:3000'
}

/** Resolved public app origin — alias for {@link getURL}. */
export function resolvePublicAppOrigin(): string {
  return getURL()
}

/** Absolute public URL when origin is known; otherwise a stable relative path. */
export function publicAppUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getURL()}${normalizedPath}`
}
