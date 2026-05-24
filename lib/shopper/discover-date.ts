import { addDays, startOfDay } from 'date-fns'
import { formatDateParam, parseDateParam } from '@/lib/shopper/events'

export type DateFilterPreset = 'today' | 'tomorrow' | 'weekend' | 'custom'

function weekendAnchorDate(base: Date): Date {
  const day = base.getDay()
  return addDays(base, day === 6 ? 0 : day === 0 ? -1 : 6 - day)
}

/** Resolve the calendar day used for filtering from URL preset + date param. */
export function resolveDiscoverFilterDate(
  when: string | null,
  dateParam: string | null
): { preset: DateFilterPreset; date: Date } {
  const preset: DateFilterPreset =
    when === 'tomorrow' || when === 'weekend' || when === 'custom' ? when : 'today'

  const today = startOfDay(new Date())

  if (preset === 'today') {
    return { preset, date: today }
  }
  if (preset === 'tomorrow') {
    return { preset, date: addDays(today, 1) }
  }
  if (preset === 'weekend') {
    return { preset, date: weekendAnchorDate(today) }
  }

  return { preset, date: parseDateParam(dateParam) }
}

export function discoverDateSearchParams(
  preset: DateFilterPreset,
  date: Date
): Record<string, string> {
  return {
    when: preset,
    date: formatDateParam(date),
  }
}
