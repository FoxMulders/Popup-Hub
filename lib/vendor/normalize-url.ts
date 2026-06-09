export function normalizeUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const TIKTOK_URL_RE = /tiktok\.com\/@?([\w.]+)/i
const TIKTOK_HANDLE_RE = /^@?([\w.]+)$/

/** Normalize TikTok profile input to https://tiktok.com/@handle */
export function normalizeTikTokUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed) || /tiktok\.com/i.test(trimmed)) {
    const url = normalizeUrl(trimmed)
    if (!url) return null
    const match = url.match(TIKTOK_URL_RE)
    if (match) {
      return `https://tiktok.com/@${match[1].replace(/^@/, '')}`
    }
    return url
  }

  const handleMatch = trimmed.match(TIKTOK_HANDLE_RE)
  if (handleMatch) {
    return `https://tiktok.com/@${handleMatch[1]}`
  }

  return normalizeUrl(trimmed)
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
