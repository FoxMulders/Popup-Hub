import { addDays, eachDayOfInterval, format, isValid, parseISO } from 'date-fns'

export type EventDayRowInput = {
  date: string
  start_time: string
  end_time: string
}

const DEFAULT_START = '08:00'
const DEFAULT_END = '15:00'

/** Next multi-day row: following calendar day + same hours as the previous row. */
export function buildNextEventDayRow(existingRows: EventDayRowInput[]): EventDayRowInput {
  const lastRow = existingRows[existingRows.length - 1]
  const start_time = lastRow?.start_time?.trim() || DEFAULT_START
  const end_time = lastRow?.end_time?.trim() || DEFAULT_END

  const datedRows = existingRows
    .filter((row) => row.date.trim())
    .sort((a, b) => a.date.localeCompare(b.date))

  let date = ''
  const latest = datedRows[datedRows.length - 1]
  if (latest?.date) {
    try {
      date = format(addDays(parseISO(latest.date.slice(0, 10)), 1), 'yyyy-MM-dd')
    } catch {
      date = ''
    }
  }

  return { date, start_time, end_time }
}

/** One row per calendar day between start and end (inclusive). */
export function buildDayRowsForDateRange(
  startDate: string,
  endDate: string,
  start_time = DEFAULT_START,
  end_time = DEFAULT_END
): EventDayRowInput[] {
  const start = parseISO(startDate.slice(0, 10))
  const end = parseISO(endDate.slice(0, 10))
  if (!isValid(start) || !isValid(end)) {
    return [{ date: startDate, start_time, end_time }]
  }
  if (end < start) {
    return [{ date: startDate, start_time, end_time }]
  }
  return eachDayOfInterval({ start, end }).map((day) => ({
    date: format(day, 'yyyy-MM-dd'),
    start_time,
    end_time,
  }))
}
