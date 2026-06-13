'use client'

import { useEffect, useId, useState } from 'react'
import { Grid3x3 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export interface FillRoomControlProps {
  scope: 'vendor' | 'patron'
  maxCapacity: number
  disabled?: boolean
  disabledReason?: string | null
  onFill: (count: number) => void
  compact?: boolean
  sidebarLayout?: boolean
  className?: string
}

export function FillRoomControl({
  scope,
  maxCapacity,
  disabled = false,
  disabledReason,
  onFill,
  compact = false,
  sidebarLayout = false,
  className,
}: FillRoomControlProps) {
  const inputId = useId()
  const [countText, setCountText] = useState('')

  useEffect(() => {
    if (maxCapacity > 0) {
      setCountText(String(maxCapacity))
    }
  }, [maxCapacity])

  const parsed = Math.floor(Number(countText))
  const hasValidCount = Number.isFinite(parsed) && parsed > 0
  const effectiveCount = hasValidCount ? Math.min(parsed, maxCapacity) : 0
  const blocked = disabled || maxCapacity <= 0
  const label = scope === 'vendor' ? 'vendor tables' : 'patron tables'
  const tooltip = blocked
    ? (disabledReason ??
      (maxCapacity <= 0
        ? 'Add a room with enough space first'
        : 'Fill room unavailable'))
    : `Replace ${label} in the active room with ${effectiveCount || '…'} table${effectiveCount === 1 ? '' : 's'} (max ${maxCapacity})`

  function handleFill() {
    if (blocked || !hasValidCount) return
    onFill(effectiveCount)
  }

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-1',
        sidebarLayout ? 'w-full' : 'shrink-0',
        className
      )}
      role="group"
      aria-label={`Fill room with ${label}`}
    >
      <Input
        id={inputId}
        type="number"
        min={1}
        max={Math.max(1, maxCapacity)}
        inputMode="numeric"
        value={countText}
        disabled={blocked}
        onChange={(e) => setCountText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleFill()
          }
        }}
        aria-label={`Number of ${label}`}
        title={`Up to ${maxCapacity} fit in this room`}
        className={cn(
          'h-8 shrink-0 tabular-nums',
          sidebarLayout ? 'w-full min-w-0' : 'w-[3.25rem] px-1.5 text-center',
          compact ? 'text-[11px]' : 'text-xs'
        )}
      />
      <button
        type="button"
        disabled={blocked || !hasValidCount}
        onClick={handleFill}
        title={tooltip}
        className={cn(
          'inline-flex shrink-0 items-center justify-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors disabled:opacity-50',
          scope === 'vendor'
            ? 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100'
            : 'border-violet-300 bg-violet-50 text-violet-950 hover:bg-violet-100',
          sidebarLayout ? 'h-8 flex-1' : 'h-8',
          compact && !sidebarLayout ? 'px-1.5' : 'px-2.5'
        )}
      >
        <Grid3x3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {sidebarLayout ? 'Fill room' : compact ? 'Fill' : 'Fill room'}
      </button>
    </div>
  )
}
