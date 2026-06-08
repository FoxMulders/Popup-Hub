'use client'

import { Globe2 } from 'lucide-react'
import {
  DEFAULT_DISTANCE_RADIUS_KM,
  DISTANCE_RADIUS_MAX_KM,
  DISTANCE_RADIUS_MIN_KM,
  DISTANCE_RADIUS_STEP_KM,
  clampSliderRadiusKm,
  formatDistanceRadiusKm,
  type DistanceRadiusKm,
} from '@/lib/markets/distance-radius'
import { cn } from '@/lib/utils'

interface DistanceRadiusPickerProps {
  value: number | null
  onChange: (km: DistanceRadiusKm) => void
  className?: string
}

/**
 * Continuous slider for picking a search radius. The previous preset
 * card layout is replaced by a single `<input type="range">` paired with
 * an "Everywhere" toggle button so coordinators can either dial in a
 * specific km value or opt out of distance filtering entirely.
 *
 * Native `<input type="range">` is used (rather than a custom drag
 * primitive) because it has first-class touch support on iOS and Android
 * and keyboards announce the value via the live <output>.
 */
export function DistanceRadiusPicker({ value, onChange, className }: DistanceRadiusPickerProps) {
  const showingEverywhere = value == null
  const sliderValue = showingEverywhere
    ? DEFAULT_DISTANCE_RADIUS_KM
    : clampSliderRadiusKm(value ?? DEFAULT_DISTANCE_RADIUS_KM)

  function handleSliderInput(next: number) {
    onChange(clampSliderRadiusKm(next))
  }

  function handleEverywhereToggle() {
    onChange(showingEverywhere ? DEFAULT_DISTANCE_RADIUS_KM : null)
  }

  return (
    <div
      className={cn(
        'rounded-2xl border-2 border-stone-200 bg-white p-4 shadow-sm',
        'space-y-3',
        className
      )}
      role="group"
      aria-label="Search radius"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label
          htmlFor="distance-radius-slider"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          Search radius
        </label>
        <output
          htmlFor="distance-radius-slider"
          className={cn(
            'text-lg font-black tabular-nums',
            showingEverywhere ? 'text-forest' : 'text-foreground'
          )}
          aria-live="polite"
        >
          {showingEverywhere ? 'Everywhere' : formatDistanceRadiusKm(sliderValue)}
        </output>
      </div>

      <input
        id="distance-radius-slider"
        type="range"
        min={DISTANCE_RADIUS_MIN_KM}
        max={DISTANCE_RADIUS_MAX_KM}
        step={DISTANCE_RADIUS_STEP_KM}
        value={sliderValue}
        onChange={(e) => handleSliderInput(Number(e.target.value))}
        aria-valuemin={DISTANCE_RADIUS_MIN_KM}
        aria-valuemax={DISTANCE_RADIUS_MAX_KM}
        aria-valuenow={sliderValue}
        aria-valuetext={formatDistanceRadiusKm(sliderValue)}
        disabled={showingEverywhere}
        className={cn(
          'w-full cursor-pointer accent-forest',
          'h-3 rounded-full appearance-none',
          'bg-stone-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2',
          // touch target: enlarge native thumb on mobile via accent + range hacks
          '[--track-h:0.75rem] touch-manipulation',
          showingEverywhere && 'opacity-40'
        )}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span aria-hidden>{DISTANCE_RADIUS_MIN_KM} km</span>
        <span aria-hidden>{DISTANCE_RADIUS_MAX_KM} km</span>
      </div>

      <button
        type="button"
        onClick={handleEverywhereToggle}
        className={cn(
          'inline-flex w-full items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-xs font-bold transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2',
          showingEverywhere
            ? 'border-forest bg-forest text-white shadow-md'
            : 'border-stone-200 bg-white text-foreground hover:border-forest/50 hover:bg-sage-50'
        )}
        aria-pressed={showingEverywhere}
      >
        <Globe2 className="h-3.5 w-3.5" />
        {showingEverywhere ? 'Showing Popup Hub markets everywhere' : 'Show markets everywhere'}
      </button>
    </div>
  )
}
