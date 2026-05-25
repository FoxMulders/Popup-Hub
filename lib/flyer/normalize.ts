import { isValid, parseISO } from 'date-fns'

/** Normalize to YYYY-MM-DD when possible. */
export function normalizeFlyerDate(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = parseISO(trimmed)
    return isValid(d) ? trimmed : null
  }

  const slash = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (slash) {
    const iso = `${slash[3]}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`
    const d = parseISO(iso)
    return isValid(d) ? iso : null
  }

  const parsed = new Date(trimmed)
  if (isValid(parsed)) {
    return parsed.toISOString().slice(0, 10)
  }

  return null
}

/** Normalize to 24h HH:mm. */
export function normalizeFlyerTime(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim().toLowerCase()

  const twentyFour = trimmed.match(/^(\d{1,2}):(\d{2})$/)
  if (twentyFour) {
    const h = Number(twentyFour[1])
    const m = twentyFour[2]
    if (h >= 0 && h <= 23) return `${String(h).padStart(2, '0')}:${m}`
  }

  const ampm = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/)
  if (ampm) {
    let h = Number(ampm[1])
    const m = ampm[2] ?? '00'
    if (ampm[3] === 'pm' && h < 12) h += 12
    if (ampm[3] === 'am' && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${m}`
  }

  return null
}

export function splitFlyerLocation(raw: string | null | undefined): {
  locationName: string | null
  address: string | null
} {
  if (!raw?.trim()) return { locationName: null, address: null }
  const trimmed = raw.trim()
  const comma = trimmed.indexOf(',')
  if (comma > 0) {
    return {
      locationName: trimmed.slice(0, comma).trim() || null,
      address: trimmed.slice(comma + 1).trim() || trimmed,
    }
  }
  return { locationName: trimmed, address: trimmed }
}
