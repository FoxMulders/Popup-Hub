import {
  addDays,
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
} from 'date-fns'
import type { Event, EventDay, EventListingType } from '@/types/database'
import { distanceKm, type LatLng } from '@/lib/shopper/geo'

export interface EventWithMeta extends Event {
  vendor_count?: number
  distance_km?: number
}

export function parseDateParam(value: string | null | undefined): Date {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  return startOfDay(new Date())
}

export function formatDateParam(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function eventOccursOnDate(event: Event, date: Date): boolean {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  if (event.is_multi_day && event.event_days && event.event_days.length > 0) {
    return event.event_days.some((ed) => {
      const edDate = parseISO(ed.date.length === 10 ? ed.date : ed.date.split('T')[0])
      return isSameDay(edDate, dayStart)
    })
  }

  const start = new Date(event.start_at)
  const end = new Date(event.end_at)
  return (
    isSameDay(start, dayStart) ||
    isWithinInterval(dayStart, { start: startOfDay(start), end: endOfDay(end) })
  )
}

export function getEventHoursForDate(event: Event, date: Date): string {
  if (event.is_multi_day && event.event_days?.length) {
    const dayStr = format(date, 'yyyy-MM-dd')
    const match = event.event_days.find((ed) => ed.date.startsWith(dayStr))
    if (match) {
      return `${formatTime(match.start_time)} – ${formatTime(match.end_time)}`
    }
  }
  return `${format(new Date(event.start_at), 'h:mm a')} – ${format(new Date(event.end_at), 'h:mm a')}`
}

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m ?? 0, 0, 0)
  return format(d, 'h:mm a')
}

export function getEventDateLabel(event: Event, selectedDate?: Date): string {
  if (event.is_multi_day && event.event_days && event.event_days.length > 1) {
    const sorted = [...event.event_days].sort((a, b) => a.date.localeCompare(b.date))
    const first = parseISO(sorted[0].date)
    const last = parseISO(sorted[sorted.length - 1].date)
    return `${format(first, 'EEE, MMM d')} – ${format(last, 'MMM d, yyyy')}`
  }
  const d = selectedDate ?? new Date(event.start_at)
  return format(d, 'EEE, MMM d, yyyy')
}

export function filterEventsByDate(events: Event[], date: Date): Event[] {
  return events.filter((e) => eventOccursOnDate(e, date))
}

export function filterEventsByWeekend(events: Event[], weekendAnchor: Date): Event[] {
  const days = getWeekendDates(weekendAnchor)
  return events.filter((e) => days.some((day) => eventOccursOnDate(e, day)))
}

/** Last calendar day of the current week (Sunday on or after `start`). */
export function getThisWeekEndDate(start: Date): Date {
  const day = startOfDay(start)
  const weekday = day.getDay()
  if (weekday === 0) return day
  return startOfDay(addDays(day, 7 - weekday))
}

export function eventOccursInDateRange(event: Event, rangeStart: Date, rangeEnd: Date): boolean {
  let current = startOfDay(rangeStart)
  const end = startOfDay(rangeEnd)
  while (current <= end) {
    if (eventOccursOnDate(event, current)) return true
    current = addDays(current, 1)
  }
  return false
}

export function filterEventsByDateRange(
  events: Event[],
  rangeStart: Date,
  rangeEnd: Date
): Event[] {
  return events.filter((e) => eventOccursInDateRange(e, rangeStart, rangeEnd))
}

export function getThisMonthEndDate(start: Date): Date {
  return startOfDay(endOfMonth(start))
}

export function filterEventsByListingType(
  events: Event[],
  listingType: EventListingType
): Event[] {
  return events.filter((e) => (e.listing_type ?? 'community_market') === listingType)
}

export function sortEventsByDistance(
  events: EventWithMeta[],
  origin: LatLng
): EventWithMeta[] {
  return [...events]
    .map((e) => ({
      ...e,
      distance_km: distanceKm(origin, { lat: e.latitude, lng: e.longitude }),
    }))
    .sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0))
}

export function filterEventsByRadius(
  events: EventWithMeta[],
  radiusKm: number | null
): EventWithMeta[] {
  if (radiusKm == null) return events
  return events.filter((e) => (e.distance_km ?? Infinity) <= radiusKm)
}

export function getWeekendDates(base: Date): Date[] {
  const day = base.getDay()
  const saturday = addDays(base, day === 6 ? 0 : day === 0 ? -1 : 6 - day)
  return [saturday, addDays(saturday, 1)]
}

export function groupEventsByDateHeader(events: Event[], date: Date): Map<string, Event[]> {
  const map = new Map<string, Event[]>()
  for (const e of events) {
    const key = format(date, 'EEEE, MMMM d')
    const list = map.get(key) ?? []
    list.push(e)
    map.set(key, list)
  }
  return map
}

export function buildScheduleLines(event: Event): { label: string; hours: string }[] {
  if (event.is_multi_day && event.event_days?.length) {
    return [...event.event_days]
      .sort((a, b) => a.sort_order - b.sort_order || a.date.localeCompare(b.date))
      .map((ed: EventDay) => ({
        label: format(parseISO(ed.date), 'EEE, MMM d'),
        hours: `${formatTime(ed.start_time)} – ${formatTime(ed.end_time)}`,
      }))
  }
  return [
    {
      label: format(new Date(event.start_at), 'EEE, MMM d, yyyy'),
      hours: `${format(new Date(event.start_at), 'h:mm a')} – ${format(new Date(event.end_at), 'h:mm a')}`,
    },
  ]
}

export function buildCalendarLinks(event: Event): { google: string; icsDataUrl: string } {
  const start = new Date(event.start_at)
  const end = new Date(event.end_at)
  const title = encodeURIComponent(event.name)
  const details = encodeURIComponent(event.description ?? '')
  const location = encodeURIComponent(`${event.location_name}, ${event.address}`)
  const google = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatIcsUtc(start)}/${formatIcsUtc(end)}&details=${details}&location=${location}`

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${formatIcsUtc(start)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${event.name.replace(/,/g, '\\,')}`,
    `LOCATION:${event.location_name}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  return {
    google,
    icsDataUrl: `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`,
  }
}

function formatIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Count published markets within radius over the next N days (ignores a single-day filter). */
export function countUpcomingEventsInRadius(
  events: Event[],
  origin: LatLng,
  radiusKm: number | null,
  fromDate: Date = startOfDay(new Date()),
  horizonDays = 60
): number {
  const rangeEnd = addDays(startOfDay(fromDate), horizonDays)
  const scoped = filterEventsByListingType(events, 'community_market')
  const withMeta: EventWithMeta[] = scoped.map((e) => ({
    ...e,
    distance_km: distanceKm(origin, { lat: e.latitude, lng: e.longitude }),
  }))
  const inRadius = filterEventsByRadius(withMeta, radiusKm)
  return inRadius.filter((e) => eventOccursInDateRange(e, fromDate, rangeEnd)).length
}
