'use client'

import { useMemo, useState } from 'react'
import {
  EDMONTON_QUADRANT_OPTIONS,
  filterEdmontonVenues,
  type EdmontonQuadrantFilter,
} from '@/lib/booth-planner/edmonton-venue-registry'
import { VENUE_PRESET_OPTIONS, type VenuePresetId } from '@/lib/booth-planner/venue-presets'
import { cn } from '@/lib/utils'
import { WIZARD_SELECT_TRIGGER } from '@/lib/wizard/wizard-panel-styles'
import { WizardFilterTooltip } from '@/components/coordinator/wizard/wizard-filter-tooltip'

const selectClassName = cn(
  WIZARD_SELECT_TRIGGER,
  'rounded-lg border-2 border-stone-200 bg-card px-3 text-sm font-medium text-foreground shadow-[var(--shadow-market)] transition-all duration-200 outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/30'
)

interface EdmontonVenueTemplateBarProps {
  value: VenuePresetId
  onChange: (presetId: VenuePresetId) => void
  quadrant?: EdmontonQuadrantFilter
  onQuadrantChange?: (quadrant: EdmontonQuadrantFilter) => void
  className?: string
}

export function EdmontonVenueTemplateBar({
  value,
  onChange,
  quadrant: quadrantProp,
  onQuadrantChange,
  className,
}: EdmontonVenueTemplateBarProps) {
  const [internalQuadrant, setInternalQuadrant] = useState<EdmontonQuadrantFilter>('all')
  const quadrant = quadrantProp ?? internalQuadrant

  function handleQuadrantChange(next: EdmontonQuadrantFilter) {
    onQuadrantChange?.(next)
    if (quadrantProp === undefined) setInternalQuadrant(next)
  }

  const filteredVenues = useMemo(() => filterEdmontonVenues(quadrant, ''), [quadrant])

  const templateOptions = useMemo(() => {
    const blank = VENUE_PRESET_OPTIONS.filter((o) => o.id === 'blank')
    const dynamic = filteredVenues.map((v) => ({ id: v.id as VenuePresetId, label: v.label }))
    return [...blank, ...dynamic]
  }, [filteredVenues])

  const selectedStillVisible =
    value === 'blank' || filteredVenues.some((v) => v.id === value)

  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5 mb-4',
        className
      )}
    >
      <WizardFilterTooltip
        label="City"
        htmlFor="edmonton-city-select"
        tooltip="Location is locked to Edmonton, AB for regional consistency."
      >
        <select
          id="edmonton-city-select"
          value="edmonton-ab"
          disabled
          aria-disabled
          className={cn(selectClassName, 'cursor-not-allowed opacity-90 w-full')}
        >
          <option value="edmonton-ab">Edmonton, AB</option>
        </select>
      </WizardFilterTooltip>

      <WizardFilterTooltip
        label="City Quadrant"
        htmlFor="edmonton-quadrant-select"
        tooltip="Filters local venues. Automatically snaps to match your selected venue's district."
      >
        <select
          id="edmonton-quadrant-select"
          value={quadrant}
          onChange={(e) => handleQuadrantChange(e.target.value as EdmontonQuadrantFilter)}
          className={cn(selectClassName, 'w-full')}
        >
          {EDMONTON_QUADRANT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id} className="whitespace-normal">
              {option.label}
            </option>
          ))}
        </select>
      </WizardFilterTooltip>

      <WizardFilterTooltip
        label="Venue Template"
        htmlFor="edmonton-venue-template"
        tooltip="Loads a pre-configured Edmonton community hall profile, auto-populating layout matrix rules, physical wall constraints, and coordinates."
        className="sm:col-span-2 lg:col-span-1"
      >
        <select
          id="edmonton-venue-template"
          value={selectedStillVisible ? value : 'blank'}
          onChange={(e) => onChange(e.target.value as VenuePresetId)}
          className={cn(selectClassName, 'w-full')}
        >
          {templateOptions.map((option) => (
            <option key={option.id} value={option.id} className="whitespace-normal break-words">
              {option.label}
            </option>
          ))}
        </select>
        {!selectedStillVisible ? (
          <p className="text-[10px] text-muted-foreground whitespace-normal break-words mt-1">
            Active template hidden by quadrant filter — switch quadrant to re-select.
          </p>
        ) : null}
      </WizardFilterTooltip>
    </div>
  )
}
