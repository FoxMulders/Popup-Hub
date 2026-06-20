import { format, formatDistanceToNow } from 'date-fns'

function parseSafeDate(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Format an event ISO timestamp for coordinator market lists — never throws. */
export function safeFormatMarketDate(
  iso: string | null | undefined,
  pattern = 'EEE, MMM d, yyyy',
  fallback = 'Date TBD'
): string {
  const date = parseSafeDate(iso)
  if (!date) return fallback
  try {
    return format(date, pattern)
  } catch {
    return fallback
  }
}

/** Relative time for application cards and activity feeds — never throws. */
export function safeFormatDistanceToNow(
  iso: string | null | undefined,
  fallback = 'recently'
): string {
  const date = parseSafeDate(iso)
  if (!date) return fallback
  try {
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return fallback
  }
}

/** Safe time range for event hub headers — never throws. */
export function safeFormatMarketTimeRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined
): string {
  const start = safeFormatMarketDate(startIso, 'h:mm a', '')
  const end = safeFormatMarketDate(endIso ?? startIso, 'h:mm a', '')
  if (!start && !end) return 'Time TBD'
  if (!end || start === end) return start || end
  return `${start} – ${end}`
}

export function safeEventTimestamp(iso: string | null | undefined): number {
  const date = parseSafeDate(iso)
  return date?.getTime() ?? 0
}
