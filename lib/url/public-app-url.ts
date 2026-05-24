/** Absolute public URL when NEXT_PUBLIC_APP_URL is set; otherwise a stable relative path. */
export function publicAppUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  return base ? `${base}${normalizedPath}` : normalizedPath
}
