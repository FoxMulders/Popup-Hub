import { formatShortDate, formatTimeLabel } from '@/components/coordinator/wizard/wizard-time-options'

export type WizardDayRow = {
  date: string
  start_time: string
  end_time: string
}

export function buildWizardScheduleLines(params: {
  scheduleType: 'single' | 'multi'
  dayRows: WizardDayRow[]
  startDate: string
  startTime: string
  endTime: string
}): string[] {
  const { scheduleType, dayRows, startDate, startTime, endTime } = params

  if (scheduleType === 'multi') {
    return [...dayRows]
      .filter((row) => row.date && row.start_time && row.end_time)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(
        (row) =>
          `${formatShortDate(row.date)} · ${formatTimeLabel(row.start_time)} – ${formatTimeLabel(row.end_time)}`
      )
  }

  if (startDate && startTime && endTime) {
    return [`${formatShortDate(startDate)} · ${formatTimeLabel(startTime)} – ${formatTimeLabel(endTime)}`]
  }

  return []
}
