import { addDays, format, parseISO } from 'date-fns'

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
