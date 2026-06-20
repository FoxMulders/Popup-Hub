'use client'

import { useState } from 'react'
import { ChevronDown, Gavel } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DateFilterPreset } from '@/lib/shopper/discover-date'
import { formatDateParam, parseDateParam } from '@/lib/shopper/events'

interface DiscoverWhenFilterProps {
  datePreset: DateFilterPreset
  filterDate: Date
  liveAuctionsOnly: boolean
  onPresetChange: (preset: DateFilterPreset, date?: Date) => void
  onLiveAuctionsToggle: () => void
  className?: string
}

const PRIMARY_PRESETS: Array<{ id: DateFilterPreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'This Weekend' },
]

const EXTENDED_PRESETS: Array<{ id: DateFilterPreset; label: string }> = [
  { id: 'next_weekend', label: 'Next Weekend' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
]

function presetButtonClass(active: boolean): string {
  return cn(
    'min-h-10 touch-manipulation rounded-full px-4',
    active && 'shadow-sm'
  )
}

export function DiscoverWhenFilter({
  datePreset,
  filterDate,
  liveAuctionsOnly,
  onPresetChange,
  onLiveAuctionsToggle,
  className,
}: DiscoverWhenFilterProps) {
  const [showMoreDates, setShowMoreDates] = useState(
    () =>
      datePreset === 'next_weekend' ||
      datePreset === 'this_week' ||
      datePreset === 'this_month' ||
      datePreset === 'custom'
  )

  const extendedActive = EXTENDED_PRESETS.some((preset) => preset.id === datePreset)
  const moreDatesActive = extendedActive || datePreset === 'custom' || liveAuctionsOnly

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">When</p>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-medium text-forest hover:underline underline-offset-2 sm:hidden"
          aria-expanded={showMoreDates}
          onClick={() => setShowMoreDates((open) => !open)}
        >
          {showMoreDates ? 'Fewer dates' : 'More dates'}
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', showMoreDates && 'rotate-180')}
            aria-hidden
          />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRIMARY_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={datePreset === preset.id ? 'default' : 'outline'}
            className={presetButtonClass(datePreset === preset.id)}
            onClick={() => onPresetChange(preset.id)}
          >
            {preset.label}
          </Button>
        ))}

        <div className="hidden flex-wrap gap-2 sm:flex">
          {EXTENDED_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant={datePreset === preset.id ? 'default' : 'outline'}
              className={presetButtonClass(datePreset === preset.id)}
              onClick={() => onPresetChange(preset.id)}
            >
              {preset.label}
            </Button>
          ))}
          <DatePickerChip
            active={datePreset === 'custom'}
            value={formatDateParam(filterDate)}
            onChange={(value) => onPresetChange('custom', parseDateParam(value))}
          />
          <Button
            type="button"
            size="sm"
            variant={liveAuctionsOnly ? 'default' : 'outline'}
            className="min-h-10 touch-manipulation gap-1.5 rounded-full px-4"
            onClick={onLiveAuctionsToggle}
          >
            <Gavel className="h-3.5 w-3.5" aria-hidden />
            Quarter auctions
          </Button>
        </div>

        {showMoreDates ? (
          <div className="flex w-full flex-wrap gap-2 sm:hidden">
            {EXTENDED_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                size="sm"
                variant={datePreset === preset.id ? 'default' : 'outline'}
                className={presetButtonClass(datePreset === preset.id)}
                onClick={() => onPresetChange(preset.id)}
              >
                {preset.label}
              </Button>
            ))}
            <DatePickerChip
              active={datePreset === 'custom'}
              value={formatDateParam(filterDate)}
              onChange={(value) => onPresetChange('custom', parseDateParam(value))}
            />
            <Button
              type="button"
              size="sm"
              variant={liveAuctionsOnly ? 'default' : 'outline'}
              className="min-h-10 touch-manipulation gap-1.5 rounded-full px-4"
              onClick={onLiveAuctionsToggle}
            >
              <Gavel className="h-3.5 w-3.5" aria-hidden />
              Quarter auctions
            </Button>
          </div>
        ) : null}

        {!showMoreDates && moreDatesActive ? (
          <span className="inline-flex min-h-10 items-center rounded-full border border-forest/20 bg-sage-50 px-3 text-xs font-medium text-forest sm:hidden">
            Extra filters active
          </span>
        ) : null}
      </div>
    </div>
  )
}

function DatePickerChip({
  active,
  value,
  onChange,
}: {
  active: boolean
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label
      className={cn(
        'inline-flex min-h-10 touch-manipulation items-center gap-2 rounded-full border px-4 text-sm',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-input bg-white text-foreground'
      )}
    >
      <span>Select date</span>
      <input
        type="date"
        className={cn(
          'min-h-9 border-0 bg-transparent outline-none touch-manipulation',
          active ? 'text-primary-foreground' : ''
        )}
        value={value}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value)
        }}
      />
    </label>
  )
}
