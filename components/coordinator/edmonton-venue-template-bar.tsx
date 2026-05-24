'use client'

import { useMemo } from 'react'
import { filterEdmontonVenues } from '@/lib/booth-planner/edmonton-venue-registry'
import { VENUE_PRESET_OPTIONS, type VenuePresetId } from '@/lib/booth-planner/venue-presets'
import {
  DEFAULT_MARKET_CITY_ID,
  MARKET_CITIES,
  isEdmontonMarketCity,
} from '@/lib/wizard/market-cities'
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
  city?: string
  onCityChange?: (cityId: string) => void
  className?: string
}

export function EdmontonVenueTemplateBar({
  value,
  onChange,
  city: cityProp,
  onCityChange,
  className,
}: EdmontonVenueTemplateBarProps) {
  const city = cityProp ?? DEFAULT_MARKET_CITY_ID
  const showEdmontonTemplates = isEdmontonMarketCity(city)

  const templateOptions = useMemo(() => {
    const blank = VENUE_PRESET_OPTIONS.filter((o) => o.id === 'blank')
    if (!showEdmontonTemplates) return blank

    const edmontonVenues = filterEdmontonVenues('all', '')
    const dynamic = edmontonVenues.map((v) => ({ id: v.id as VenuePresetId, label: v.label }))
    return [...blank, ...dynamic]
  }, [showEdmontonTemplates])

  const selectedStillVisible =
    value === 'blank' || templateOptions.some((option) => option.id === value)

  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5 mb-4',
        className
      )}
    >
      <WizardFilterTooltip
        label="City"
        htmlFor="market-city-select"
        tooltip="Select the city for this market. Edmonton venue templates are available only for Edmonton."
      >
        <select
          id="market-city-select"
          value={city}
          onChange={(e) => onCityChange?.(e.target.value)}
          disabled={!onCityChange}
          aria-disabled={!onCityChange}
          className={cn(
            selectClassName,
            'w-full',
            !onCityChange && 'cursor-not-allowed opacity-90'
          )}
        >
          {MARKET_CITIES.map((option) => (
            <option key={option.id} value={option.id} className="whitespace-normal">
              {option.label}
            </option>
          ))}
        </select>
      </WizardFilterTooltip>

      <WizardFilterTooltip
        label="Venue Template"
        htmlFor="edmonton-venue-template"
        tooltip={
          showEdmontonTemplates
            ? 'Loads a pre-configured Edmonton community hall profile, auto-populating layout matrix rules, physical wall constraints, and coordinates.'
            : 'Edmonton venue templates are only available when Edmonton is selected. Use a blank template for other cities.'
        }
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
            Active template is unavailable for this city — switched to blank.
          </p>
        ) : null}
      </WizardFilterTooltip>
    </div>
  )
}
