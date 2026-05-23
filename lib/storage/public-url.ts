/**
 * Normalize vendor/event asset URLs for display.
 * Accepts full public URLs, blob previews, or storage object paths.
 */
export function resolvePublicAssetUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  if (!base) return trimmed

  const path = trimmed.replace(/^\//, '')
  if (path.startsWith('storage/v1/object/public/')) {
    return `${base}/${path}`
  }

  return `${base}/storage/v1/object/public/vendor-assets/${path}`
}
