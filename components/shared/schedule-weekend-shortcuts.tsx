'use client'

import { Button } from '@/components/ui/button'
import { getWeekendScheduleRange } from '@/lib/shopper/weekend-schedule'

interface ScheduleWeekendShortcutsProps {
  scheduleType: 'single' | 'multi'
  onApply: (range: { startDate: string; endDate: string }) => void
  disabled?: boolean
}

export function ScheduleWeekendShortcuts({
  scheduleType,
  onApply,
  disabled,
}: ScheduleWeekendShortcutsProps) {
  function apply(which: 'this' | 'next') {
    const range = getWeekendScheduleRange(which)
    if (scheduleType === 'single') {
      onApply({ startDate: range.startDate, endDate: range.startDate })
      return
    }
    onApply({ startDate: range.startDate, endDate: range.endDate })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Quick dates
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        className="min-h-9"
        onClick={() => apply('this')}
      >
        This Weekend
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        className="min-h-9"
        onClick={() => apply('next')}
      >
        Next Weekend
      </Button>
    </div>
  )
}
