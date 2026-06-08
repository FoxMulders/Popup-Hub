import { addDays, startOfDay } from 'date-fns'
import { formatDateParam, parseDateParam } from '@/lib/shopper/events'

export type DateFilterPreset =
  | 'today'
  | 'tomorrow'
  | 'weekend'
  | 'next_weekend'
  | 'this_week'
  | 'this_month'
  | 'custom'

function weekendAnchorDate(base: Date): Date {
  const day = base.getDay()
  return addDays(base, day === 6 ? 0 : day === 0 ? -1 : 6 - day)
}

function nextWeekendAnchorDate(base: Date): Date {
  return addDays(weekendAnchorDate(base), 7)
}

/** Resolve the calendar day used for filtering from URL preset + date param. */
export function resolveDiscoverFilterDate(
  when: string | null,
  dateParam: string | null
): { preset: DateFilterPreset; date: Date } {
  const preset: DateFilterPreset =
    when === 'tomorrow' ||
    when === 'weekend' ||
    when === 'next_weekend' ||
    when === 'this_week' ||
    when === 'this_month' ||
    when === 'custom'
      ? when
      : 'today'

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
  if (preset === 'next_weekend') {
    return { preset, date: nextWeekendAnchorDate(today) }
  }
  if (preset === 'this_week' || preset === 'this_month') {
    return { preset, date: today }
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
