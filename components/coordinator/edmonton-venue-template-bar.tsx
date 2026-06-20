'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookmarkPlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { VENUE_PRESET_OPTIONS, type VenuePresetId } from '@/lib/booth-planner/venue-presets'
import {
  DEFAULT_MARKET_CITY_ID,
  MARKET_CITIES,
} from '@/lib/wizard/market-cities'
import {
  deleteCoordinatorSavedVenue,
  listCoordinatorSavedVenues,
  saveCoordinatorVenue,
  touchCoordinatorSavedVenue,
} from '@/lib/coordinator/saved-venues'
import {
  shouldSubmitPlatformVenue,
  submitPlatformVenue,
} from '@/lib/venues/platform-venue-submissions'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { WIZARD_SELECT_TRIGGER } from '@/lib/wizard/wizard-panel-styles'
import { WizardFilterTooltip } from '@/components/coordinator/wizard/wizard-filter-tooltip'
import type { CoordinatorSavedVenue } from '@/types/database'

const selectClassName = cn(
  WIZARD_SELECT_TRIGGER,
  'rounded-lg border-2 border-stone-200 bg-white px-3 text-sm font-medium text-foreground shadow-[var(--shadow-market)] transition-all duration-200 outline-none focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/30'
)

/** Prefix used to encode saved-venue rows in the unified template <select>. */
const SAVED_VENUE_VALUE_PREFIX = 'saved::'

interface EdmontonVenueTemplateBarProps {
  value: VenuePresetId
  onChange: (presetId: VenuePresetId) => void
  city?: string
  onCityChange?: (cityId: string) => void
  className?: string
  /**
   * Coordinator-scoped saved-venues integration. When provided, the venue
   * template <select> exposes the coordinator's saved venues as an opt-group
   * at the top of the dropdown so picking a venue and a preset are unified
   * into a single field.
   */
  coordinatorId?: string
  onApplySavedVenue?: (venue: CoordinatorSavedVenue) => void
  /** Live form context — required to enable the inline "Save for future" action. */
  locationName?: string
  address?: string
  lat?: number
  lng?: number
  pinDropped?: boolean
  skipVenueLayout?: boolean
}

export function EdmontonVenueTemplateBar({
  value,
  onChange,
  city: cityProp,
  onCityChange,
  className,
  coordinatorId,
  onApplySavedVenue,
  locationName = '',
  address = '',
  lat = 0,
  lng = 0,
  pinDropped = false,
  skipVenueLayout = false,
}: EdmontonVenueTemplateBarProps) {
  const supabase = createClient()
  const city = cityProp ?? DEFAULT_MARKET_CITY_ID

  const savedVenuesEnabled = Boolean(coordinatorId && onApplySavedVenue)
  const [savedVenues, setSavedVenues] = useState<CoordinatorSavedVenue[]>([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const refreshSavedVenues = useCallback(async () => {
    if (!coordinatorId) return
    setSavedLoading(true)
    const { venues, error } = await listCoordinatorSavedVenues(supabase, coordinatorId)
    setSavedLoading(false)
    if (error) {
      toast.error('Could not load saved venues')
      return
    }
    setSavedVenues(venues)
  }, [coordinatorId, supabase])

  useEffect(() => {
    if (!savedVenuesEnabled) return
    void refreshSavedVenues()
  }, [savedVenuesEnabled, refreshSavedVenues])

  const templateOptions = useMemo(() => {
    // Preset hall blueprints are hidden until dimensions are verified — keep the field for blank + saved venues.
    return VENUE_PRESET_OPTIONS.filter((o) => o.id === 'blank')
  }, [])

  const selectedStillVisible =
    value === 'blank' || templateOptions.some((option) => option.id === value)

  // The canonical value for the <select>. We surface preset ids verbatim and
  // never encode a saved-venue id in `value` — picking a saved venue fires
  // onApplySavedVenue and the select snaps back to the resulting preset.
  const selectValue = selectedStillVisible ? value : 'blank'

  async function handleSelectChange(raw: string) {
    if (raw.startsWith(SAVED_VENUE_VALUE_PREFIX)) {
      const venueId = raw.slice(SAVED_VENUE_VALUE_PREFIX.length)
      const venue = savedVenues.find((v) => v.id === venueId)
      if (!venue || !onApplySavedVenue) return
      onApplySavedVenue(venue)
      await touchCoordinatorSavedVenue(supabase, venue.id)
      void refreshSavedVenues()
      toast.success(`Loaded ${venue.location_name}`)
      return
    }
    onChange(raw as VenuePresetId)
  }

  async function handleSaveVenue() {
    if (!coordinatorId) return
    if (!locationName.trim()) {
      toast.error('Enter a venue name before saving')
      return
    }
    if (!address.trim()) {
      toast.error('Enter an address before saving')
      return
    }
    if (!pinDropped) {
      toast.error('Drop a map pin before saving this venue')
      return
    }

    setSaving(true)
    const { venue, error } = await saveCoordinatorVenue(supabase, coordinatorId, {
      locationName,
      address,
      latitude: lat,
      longitude: lng,
      venuePresetId: value,
      skipVenueLayout,
      marketCity: city,
    })
    setSaving(false)

    if (error || !venue) {
      toast.error(error?.message ?? 'Could not save venue')
      return
    }

    const shouldSubmit = await shouldSubmitPlatformVenue(supabase, coordinatorId, {
      locationName,
      address,
      latitude: lat,
      longitude: lng,
      marketCity: city,
    })
    if (shouldSubmit) {
      const { created, error: submitError } = await submitPlatformVenue(supabase, coordinatorId, {
        locationName,
        address,
        latitude: lat,
        longitude: lng,
        marketCity: city,
      })
      if (submitError) {
        toast.error(submitError.message)
      } else if (created) {
        toast.message('New venue submitted for admin review')
      }
    }

    await refreshSavedVenues()
    toast.success('Venue saved for future events')
  }

  async function handleDeleteSaved(id: string) {
    const venue = savedVenues.find((v) => v.id === id)
    if (!venue) return
    if (!window.confirm(`Remove "${venue.location_name}" from saved venues?`)) return
    const { error } = await deleteCoordinatorSavedVenue(supabase, id)
    if (error) {
      toast.error(error.message)
      return
    }
    await refreshSavedVenues()
    toast.message('Saved venue removed')
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
        <WizardFilterTooltip
          label="City"
          htmlFor="market-city-select"
          tooltip="Select the city for this market."
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
          label="Venue Template / Saved Venue"
          htmlFor="edmonton-venue-template"
          tooltip={
            savedVenuesEnabled
              ? 'Pick one of your saved venues to auto-fill name, address, and map pin. "Blank canvas" leaves dimensions free for a custom venue.'
              : 'Choose blank canvas to set your own venue dimensions. Saved venue templates appear here once you save a location.'
          }
        >
          <select
            id="edmonton-venue-template"
            value={selectValue}
            onChange={(e) => void handleSelectChange(e.target.value)}
            className={cn(selectClassName, 'w-full')}
          >
            {savedVenuesEnabled && savedVenues.length > 0 ? (
              <optgroup label="Your saved venues">
                {savedVenues.map((venue) => (
                  <option
                    key={venue.id}
                    value={`${SAVED_VENUE_VALUE_PREFIX}${venue.id}`}
                    className="whitespace-normal break-words"
                  >
                    ★ {venue.location_name} — {venue.address}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="Template">
              {templateOptions.map((option) => (
                <option
                  key={option.id}
                  value={option.id}
                  className="whitespace-normal break-words"
                >
                  {option.label}
                </option>
              ))}
            </optgroup>
          </select>
          {!selectedStillVisible ? (
            <p className="text-[10px] text-muted-foreground whitespace-normal break-words mt-1">
              Active template is unavailable for this city — switched to blank.
            </p>
          ) : null}
        </WizardFilterTooltip>
      </div>

      {savedVenuesEnabled ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={saving || savedLoading}
            onClick={() => void handleSaveVenue()}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BookmarkPlus className="h-3.5 w-3.5" />
            )}
            Save current venue for future markets
          </Button>
          {savedVenues.length > 0 ? (
            <span className="text-muted-foreground">
              {savedVenues.length} saved
              {' · '}
              <button
                type="button"
                className="underline-offset-2 hover:underline"
                onClick={() => {
                  const id = window.prompt(
                    'Remove which saved venue? Enter the exact venue name to delete it.'
                  )
                  if (!id) return
                  const target = savedVenues.find(
                    (v) => v.location_name.toLowerCase() === id.trim().toLowerCase()
                  )
                  if (!target) {
                    toast.message('No saved venue matched that name')
                    return
                  }
                  void handleDeleteSaved(target.id)
                }}
              >
                manage
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      {savedVenuesEnabled && savedVenues.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {savedVenues.slice(0, 6).map((venue) => (
            <li
              key={venue.id}
              className="group inline-flex items-center gap-1 rounded-md border border-stone-200/80 bg-card px-2 py-1 text-[11px]"
            >
              <button
                type="button"
                className="text-foreground hover:underline truncate max-w-[24ch]"
                onClick={() => void handleSelectChange(`${SAVED_VENUE_VALUE_PREFIX}${venue.id}`)}
                title={`${venue.location_name} — ${venue.address}`}
              >
                ★ {venue.location_name}
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove ${venue.location_name}`}
                onClick={() => void handleDeleteSaved(venue.id)}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
