export function normalizeUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

export function isValidUrl(raw: string | null | undefined): boolean {
  const n = normalizeUrl(raw)
  if (!n) return true
  try {
    new URL(n)
    return true
  } catch {
    return false
  }
}
