import { addDays, setHours, setMinutes, startOfDay } from 'date-fns'
import type { ReminderOffset } from '@/types/database'

export const REMINDER_OPTIONS: { offset: ReminderOffset; label: string }[] = [
  { offset: 'morning_of', label: 'Morning of (8:00 AM)' },
  { offset: 'one_day_before', label: '1 day before' },
  { offset: 'three_days_before', label: '3 days before' },
  { offset: 'one_week_before', label: '1 week before' },
]

export function computeRemindAt(
  eventStartAt: string,
  offset: ReminderOffset
): Date {
  const start = new Date(eventStartAt)
  switch (offset) {
    case 'morning_of':
      return setMinutes(setHours(startOfDay(start), 8), 0)
    case 'one_day_before':
      return addDays(start, -1)
    case 'three_days_before':
      return addDays(start, -3)
    case 'one_week_before':
      return addDays(start, -7)
    default:
      return addDays(start, -1)
  }
}
