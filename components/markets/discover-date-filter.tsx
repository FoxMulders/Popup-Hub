'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  discoverDateSearchParams,
  type DateFilterPreset,
} from '@/lib/shopper/discover-date'
import { formatDateParam, parseDateParam } from '@/lib/shopper/events'

interface DiscoverDateFilterProps {
  datePreset: DateFilterPreset
  filterDate: Date
  onPresetChange: (preset: DateFilterPreset, date?: Date) => void
  className?: string
}

export function DiscoverDateFilter({
  datePreset,
  filterDate,
  onPresetChange,
  className,
}: DiscoverDateFilterProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">When</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={datePreset === 'today' ? 'default' : 'outline'}
          className="min-h-11 touch-manipulation"
          onClick={() => onPresetChange('today')}
        >
          Today
        </Button>
        <Button
          type="button"
          size="sm"
          variant={datePreset === 'tomorrow' ? 'default' : 'outline'}
          className="min-h-11 touch-manipulation"
          onClick={() => onPresetChange('tomorrow')}
        >
          Tomorrow
        </Button>
        <Button
          type="button"
          size="sm"
          variant={datePreset === 'weekend' ? 'default' : 'outline'}
          className="min-h-11 touch-manipulation"
          onClick={() => onPresetChange('weekend')}
        >
          This Weekend
        </Button>
        <Button
          type="button"
          size="sm"
          variant={datePreset === 'next_weekend' ? 'default' : 'outline'}
          className="min-h-11 touch-manipulation"
          onClick={() => onPresetChange('next_weekend')}
        >
          Next Weekend
        </Button>
        <label
          className={cn(
            'inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-lg border px-3 text-sm',
            datePreset === 'custom'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-transparent'
          )}
        >
          <span>Select Date</span>
          <input
            type="date"
            className={cn(
              'min-h-9 border-0 bg-transparent outline-none touch-manipulation',
              datePreset === 'custom' ? 'text-primary-foreground' : ''
            )}
            value={formatDateParam(filterDate)}
            onChange={(e) => {
              if (e.target.value) {
                onPresetChange('custom', parseDateParam(e.target.value))
              }
            }}
            onFocus={() => {
              if (datePreset !== 'custom') {
                onPresetChange('custom', filterDate)
              }
            }}
          />
        </label>
      </div>
    </div>
  )
}

export { discoverDateSearchParams }
