import { format } from 'date-fns'

/** Format an event ISO timestamp for coordinator market lists — never throws. */
export function safeFormatMarketDate(
  iso: string | null | undefined,
  pattern = 'EEE, MMM d, yyyy',
  fallback = 'Date TBD'
): string {
  if (!iso?.trim()) return fallback
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return fallback
  try {
    return format(date, pattern)
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
  if (!iso?.trim()) return 0
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}
