'use client'

import {
  DISTANCE_RADIUS_OPTIONS,
  isDistanceRadiusActive,
  type DistanceRadiusKm,
} from '@/lib/markets/distance-radius'
import { cn } from '@/lib/utils'

interface DistanceRadiusPickerProps {
  value: number | null
  onChange: (km: DistanceRadiusKm) => void
  className?: string
}

/** High-visibility preset distance cards — no slider. */
export function DistanceRadiusPicker({ value, onChange, className }: DistanceRadiusPickerProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 md:flex md:flex-row md:gap-4',
        className
      )}
      role="radiogroup"
      aria-label="Search radius"
    >
      {DISTANCE_RADIUS_OPTIONS.map(({ id, label, km }) => {
        const active = isDistanceRadiusActive(value, km)
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(km)}
            className={cn(
              'min-h-12 flex-1 rounded-xl border-2 px-4 py-3 text-center text-sm font-bold transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2',
              active
                ? 'border-forest bg-forest text-white shadow-md ring-2 ring-forest/40'
                : 'border-stone-200 bg-white text-foreground hover:border-forest/50 hover:bg-sage-50'
            )}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
