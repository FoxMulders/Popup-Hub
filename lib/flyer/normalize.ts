import { format, isValid, parse, parseISO, startOfDay } from 'date-fns'

const MONTH_DAY_YEAR_FORMATS = [
  'EEEE, MMMM d, yyyy',
  'EEEE, MMMM d yyyy',
  'MMMM d, yyyy',
  'MMMM d yyyy',
  'MMM d, yyyy',
  'MMM d yyyy',
  'M/d/yyyy',
  'M-d-yyyy',
] as const

const MONTH_DAY_FORMATS = [
  'EEEE, MMMM d',
  'MMMM d',
  'MMM d',
  'M/d',
  'M-d',
] as const

const MULTI_DAY_SPAN_RE =
  /^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–—&]\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{4}))?$/i

/** Next calendar occurrence of a month/day (never in the past). */
export function resolveNextOccurrenceDate(
  month: number,
  day: number,
  today: Date = new Date()
): string {
  const ref = startOfDay(today)
  let year = ref.getFullYear()
  let candidate = startOfDay(new Date(year, month - 1, day))
  if (candidate < ref) {
    year += 1
    candidate = startOfDay(new Date(year, month - 1, day))
  }
  return format(candidate, 'yyyy-MM-dd')
}

function tryParseWithFormats(raw: string, formats: readonly string[], ref: Date): Date | null {
  for (const fmt of formats) {
    const parsed = parse(raw, fmt, ref)
    if (isValid(parsed)) return parsed
  }
  return null
}

function normalizeMonthDay(
  month: number,
  day: number,
  year: number | null,
  today: Date
): string {
  if (year !== null && year >= today.getFullYear()) {
    const explicit = startOfDay(new Date(year, month - 1, day))
    if (isValid(explicit) && explicit >= startOfDay(today)) {
      return format(explicit, 'yyyy-MM-dd')
    }
  }
  return resolveNextOccurrenceDate(month, day, today)
}

function normalizeParsedParts(parsed: Date, today: Date): string {
  const month = parsed.getMonth() + 1
  const day = parsed.getDate()
  const year = parsed.getFullYear()
  const currentYear = today.getFullYear()

  if (year < currentYear || startOfDay(parsed) < startOfDay(today)) {
    return resolveNextOccurrenceDate(month, day, today)
  }

  return format(parsed, 'yyyy-MM-dd')
}

/** Parse hyphenated or conjoined multi-day spans such as "Oct 5-6" or "October 5th & 6th". */
export function parseMultiDayDateSpan(
  raw: string | null | undefined,
  today: Date = new Date()
): { startDate: string; endDate: string } | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()
  const match = trimmed.match(MULTI_DAY_SPAN_RE)
  if (!match) return null

  const monthLabel = match[1]
  const startDay = Number(match[2])
  const endDay = Number(match[3])
  const explicitYear = match[4] ? Number(match[4]) : null

  const startLabel = explicitYear
    ? `${monthLabel} ${startDay}, ${explicitYear}`
    : `${monthLabel} ${startDay}`
  const startFormats = explicitYear ? MONTH_DAY_YEAR_FORMATS : MONTH_DAY_FORMATS
  const startParsed = tryParseWithFormats(startLabel, startFormats, today)
  if (!startParsed) return null

  const endParsed = new Date(startParsed.getFullYear(), startParsed.getMonth(), endDay)
  if (!isValid(endParsed) || endParsed < startParsed) return null

  const startDate = normalizeMonthDay(
    startParsed.getMonth() + 1,
    startParsed.getDate(),
    explicitYear,
    today
  )
  const endDate = normalizeMonthDay(
    endParsed.getMonth() + 1,
    endParsed.getDate(),
    explicitYear,
    today
  )

  return { startDate, endDate }
}

/** Normalize to YYYY-MM-DD when possible; applies next-occurrence year logic for ambiguous dates. */
export function normalizeFlyerDate(
  raw: string | null | undefined,
  today: Date = new Date()
): string | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()

  const multiDay = parseMultiDayDateSpan(trimmed, today)
  if (multiDay) return multiDay.startDate

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = parseISO(trimmed)
    if (!isValid(parsed)) return null
    return normalizeParsedParts(parsed, today)
  }

  const slash = trimmed.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/)
  if (slash) {
    const month = Number(slash[1])
    const day = Number(slash[2])
    const year = slash[3] ? Number(slash[3]) : null
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return normalizeMonthDay(month, day, year, today)
    }
  }

  const namedWithYear = tryParseWithFormats(trimmed, MONTH_DAY_YEAR_FORMATS, today)
  if (namedWithYear) {
    return normalizeParsedParts(namedWithYear, today)
  }

  const namedMonthDay = tryParseWithFormats(trimmed, MONTH_DAY_FORMATS, today)
  if (namedMonthDay) {
    return resolveNextOccurrenceDate(
      namedMonthDay.getMonth() + 1,
      namedMonthDay.getDate(),
      today
    )
  }

  const parsed = new Date(trimmed)
  if (isValid(parsed)) {
    return normalizeParsedParts(parsed, today)
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
