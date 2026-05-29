import { effectiveScheduleTypeForListing } from '@/lib/events/listing-type'
import type { EventListingType } from '@/types/database'

export type EventDayRowInput = {
  date: string
  start_time: string
  end_time: string
}

export type ScheduleBoundsFailureReason =
  | 'incomplete'
  | 'partial_day_rows'
  | 'end_before_start'
  | 'day_end_before_start'

export type ScheduleBoundsResult =
  | { ok: true; startAt: string; endAt: string }
  | { ok: false; reason: ScheduleBoundsFailureReason }

export function scheduleBoundsFailureMessage(reason: ScheduleBoundsFailureReason): string {
  switch (reason) {
    case 'incomplete':
      return 'Complete schedule dates and times before continuing'
    case 'partial_day_rows':
      return 'Finish or remove incomplete day rows before continuing'
    case 'end_before_start':
      return 'End date/time must be after start'
    case 'day_end_before_start':
      return "Each day's end time must be after its start time"
  }
}

function sortedDayRows(rows: EventDayRowInput[]): EventDayRowInput[] {
  return [...rows].sort((a, b) => {
    if (!a.date) return 1
    if (!b.date) return -1
    return a.date.localeCompare(b.date)
  })
}

/**
 * Resolve event start_at / end_at ISO strings from wizard schedule fields.
 * Validates ordering so saves satisfy `events_dates_check` (end_at > start_at).
 */
export function resolveEventScheduleBounds(params: {
  listingType: EventListingType | null | undefined
  scheduleType: 'single' | 'multi'
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  dayRows: EventDayRowInput[]
}): ScheduleBoundsResult {
  const effectiveSchedule = effectiveScheduleTypeForListing(
    params.listingType,
    params.scheduleType
  )

  if (effectiveSchedule === 'multi') {
    const filledRows = params.dayRows.filter((r) => r.date && r.start_time && r.end_time)
    if (filledRows.length === 0) {
      return { ok: false, reason: 'incomplete' }
    }
    if (params.dayRows.some((r) => !r.date || !r.start_time || !r.end_time)) {
      return { ok: false, reason: 'partial_day_rows' }
    }
    for (const row of filledRows) {
      const rowStart = new Date(`${row.date}T${row.start_time}`)
      const rowEnd = new Date(`${row.date}T${row.end_time}`)
      if (!Number.isFinite(rowStart.getTime()) || !Number.isFinite(rowEnd.getTime())) {
        return { ok: false, reason: 'incomplete' }
      }
      if (rowEnd <= rowStart) {
        return { ok: false, reason: 'day_end_before_start' }
      }
    }
    const sorted = sortedDayRows(filledRows)
    const startAt = new Date(`${sorted[0]!.date}T${sorted[0]!.start_time}`).toISOString()
    const endAt = new Date(
      `${sorted[sorted.length - 1]!.date}T${sorted[sorted.length - 1]!.end_time}`
    ).toISOString()
    if (new Date(endAt) <= new Date(startAt)) {
      return { ok: false, reason: 'end_before_start' }
    }
    return { ok: true, startAt, endAt }
  }

  if (!params.startDate || !params.startTime || !params.endDate || !params.endTime) {
    return { ok: false, reason: 'incomplete' }
  }
  const start = new Date(`${params.startDate}T${params.startTime}`)
  const end = new Date(`${params.endDate}T${params.endTime}`)
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return { ok: false, reason: 'incomplete' }
  }
  if (end <= start) {
    return { ok: false, reason: 'end_before_start' }
  }
  return {
    ok: true,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  }
}
