import { addDays, startOfDay } from 'date-fns'
import { formatDateParam, getWeekendDates } from '@/lib/shopper/events'

function weekendAnchorDate(base: Date): Date {
  const day = base.getDay()
  return addDays(base, day === 6 ? 0 : day === 0 ? -1 : 6 - day)
}

function nextWeekendAnchorDate(base: Date): Date {
  return addDays(weekendAnchorDate(base), 7)
}

export interface WeekendScheduleRange {
  startDate: string
  endDate: string
  label: string
}

/** Saturday–Sunday date strings for this or next weekend. */
export function getWeekendScheduleRange(which: 'this' | 'next', base = new Date()): WeekendScheduleRange {
  const today = startOfDay(base)
  const anchor = which === 'next' ? nextWeekendAnchorDate(today) : weekendAnchorDate(today)
  const [sat, sun] = getWeekendDates(anchor)
  return {
    startDate: formatDateParam(sat),
    endDate: formatDateParam(sun),
    label: which === 'next' ? 'Next weekend' : 'This weekend',
  }
}
