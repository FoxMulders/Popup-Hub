import { format } from 'date-fns'

function escapeIcs(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function formatIcsUtc(date: Date): string {
  return format(date, "yyyyMMdd'T'HHmmss'Z'")
}

export interface CalendarEventPayload {
  title: string
  description?: string | null
  location?: string | null
  startsAt: Date
  endsAt: Date | null
  uid?: string
}

export function buildGoogleCalendarUrl(payload: CalendarEventPayload): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: payload.title,
    dates: `${formatIcsUtc(payload.startsAt)}/${formatIcsUtc(
      payload.endsAt ?? new Date(payload.startsAt.getTime() + 60 * 60 * 1000)
    )}`,
  })
  if (payload.description) params.set('details', payload.description)
  if (payload.location) params.set('location', payload.location)
  params.set('sf', 'true')
  params.set('output', 'xml')
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function buildIcsBlob(payload: CalendarEventPayload): Blob {
  const end = payload.endsAt ?? new Date(payload.startsAt.getTime() + 60 * 60 * 1000)
  const uid = payload.uid ?? `${Date.now()}@popup-hub`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Popup Hub//Market Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${formatIcsUtc(new Date())}`,
    `DTSTART:${formatIcsUtc(payload.startsAt)}`,
    `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${escapeIcs(payload.title)}`,
    payload.description ? `DESCRIPTION:${escapeIcs(payload.description)}` : null,
    payload.location ? `LOCATION:${escapeIcs(payload.location)}` : null,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Market starting soon',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
}

export function downloadIcsFile(payload: CalendarEventPayload, filename = 'market-event.ics'): void {
  const blob = buildIcsBlob(payload)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function openScheduleInCalendar(payload: CalendarEventPayload): void {
  const isApple =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)

  if (isApple) {
    downloadIcsFile(payload)
    return
  }

  window.open(buildGoogleCalendarUrl(payload), '_blank', 'noopener,noreferrer')
}
