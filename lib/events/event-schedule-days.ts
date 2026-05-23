import { format, parseISO } from 'date-fns'
import type { Event, EventDay } from '@/types/database'

export type EventScheduleDayOption = {
  dayId: string | null
  date: string
  label: string
  hours: string
}

function formatScheduleTime(value: string): string {
  const [hourStr, minuteStr] = value.split(':')
  const hour = Number(hourStr)
  const minute = Number(minuteStr ?? 0)
  if (!Number.isFinite(hour)) return value

  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return format(date, 'h:mm a')
}

export function daySelectionKey(day: EventScheduleDayOption): string {
  return day.dayId ?? `date:${day.date}`
}

export function resolveEventScheduleDays(
  event: Pick<Event, 'start_at' | 'end_at' | 'is_multi_day' | 'event_days'>
): EventScheduleDayOption[] {
  if (event.is_multi_day && event.event_days && event.event_days.length > 0) {
    return [...event.event_days]
      .sort(
        (a: EventDay, b: EventDay) =>
          a.sort_order - b.sort_order || a.date.localeCompare(b.date)
      )
      .map((day) => ({
        dayId: day.id,
        date: day.date.slice(0, 10),
        label: format(parseISO(day.date.slice(0, 10)), 'EEEE, MMM d'),
        hours: `${formatScheduleTime(day.start_time)} – ${formatScheduleTime(day.end_time)}`,
      }))
  }

  const start = new Date(event.start_at)
  const end = new Date(event.end_at)
  const date = format(start, 'yyyy-MM-dd')

  return [
    {
      dayId: null,
      date,
      label: format(start, 'EEEE, MMM d'),
      hours: `${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`,
    },
  ]
}

export type AttendanceSelectionInput = {
  attendingEventDayIds?: string[]
  attendingDates?: string[]
}

export type AttendanceSelectionResult = {
  attendingEventDayIds: string[]
  attendingDates: string[]
}

export function normalizeAttendanceSelection(
  scheduleDays: EventScheduleDayOption[],
  requireFullAttendance: boolean,
  input: AttendanceSelectionInput
): AttendanceSelectionResult | { error: string } {
  const validDayIds = new Set(scheduleDays.map((day) => day.dayId).filter(Boolean) as string[])
  const validDates = new Set(scheduleDays.map((day) => day.date))

  const selectedDayIds = [...new Set((input.attendingEventDayIds ?? []).filter(Boolean))]
  const selectedDates = [...new Set((input.attendingDates ?? []).filter(Boolean))]

  if (requireFullAttendance) {
    return {
      attendingEventDayIds: scheduleDays.map((day) => day.dayId).filter(Boolean) as string[],
      attendingDates: scheduleDays.map((day) => day.date),
    }
  }

  const matchedDates = new Set<string>()
  for (const dayId of selectedDayIds) {
    if (!validDayIds.has(dayId)) {
      return { error: 'One or more selected days are invalid for this market.' }
    }
    const day = scheduleDays.find((item) => item.dayId === dayId)
    if (day) matchedDates.add(day.date)
  }

  for (const date of selectedDates) {
    if (!validDates.has(date)) {
      return { error: 'One or more selected dates are invalid for this market.' }
    }
    matchedDates.add(date)
  }

  if (matchedDates.size === 0) {
    return { error: 'Select at least one day you plan to attend.' }
  }

  return {
    attendingEventDayIds: selectedDayIds,
    attendingDates: [...matchedDates].sort(),
  }
}

export function formatAttendanceDayLabels(dates: string[]): string[] {
  return dates.map((date) => {
    try {
      return format(parseISO(date), 'EEE, MMM d')
    } catch {
      return date
    }
  })
}
