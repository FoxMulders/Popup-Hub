'use client'

import { usePlacesApiStatus } from '@/components/coordinator/floor-plan-v2/debug/places-api-status-context'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { getMarketCityById } from '@/lib/wizard/market-cities'
import {
  formatPlaceAddress,
  isNamedEstablishmentPlace,
  resolveVenueNameFromAddressPick,
} from '@/lib/wizard/google-place-venue'
import { WIZARD_FIELD_LABEL, WIZARD_INPUT } from '@/lib/wizard/wizard-panel-styles'
import type { PlaceResult, WizardPlacesAutocompleteMode } from '@/lib/wizard/wizard-place-types'
import { cn } from '@/lib/utils'
import { useGooglePlacesAutocompleteWidget } from '@/hooks/use-google-places-autocomplete-widget'
import {
  MARKET_CITIES,
  inferMarketCityId,
} from '@/lib/wizard/market-cities'

function pickAddressComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string
): string | null {
  if (!components) return null
  const match = components.find((c) => c.types.includes(type))
  return match?.long_name ?? null
}

function resolveCityIdFromPlace(
  place: google.maps.places.PlaceResult,
  fallbackAddress: string
): string | null {
  const components = place.address_components ?? undefined
  const candidates = [
    pickAddressComponent(components, 'locality'),
    pickAddressComponent(components, 'postal_town'),
    pickAddressComponent(components, 'sublocality'),
    pickAddressComponent(components, 'administrative_area_level_2'),
  ].filter((value): value is string => Boolean(value && value.trim()))

  for (const candidate of candidates) {
    const lower = candidate.trim().toLowerCase()
    const match = MARKET_CITIES.find((city) => {
      const cityName = city.label.split(',')[0]!.trim().toLowerCase()
      return lower === cityName
    })
    if (match) return match.id
  }

  const text = place.formatted_address ?? fallbackAddress
  if (!text.trim()) return null
  return inferMarketCityId(text)
}

export interface VenuePlacesAutocompleteProps {
  id: string
  mode: WizardPlacesAutocompleteMode
  label: string
  value: string
  onChange: (value: string) => void
  cityId: string
  onPlaceSelect: (place: PlaceResult) => void
}

export function VenuePlacesAutocomplete({
  id,
  mode,
  label,
  value,
  onChange,
  cityId,
  onPlaceSelect,
}: VenuePlacesAutocompleteProps) {
  const { reportPlacesApi } = usePlacesApiStatus()
  const city = getMarketCityById(cityId)

  const handlePlaceChanged = useCallback(
    (place: google.maps.places.PlaceResult) => {
      if (!place.geometry?.location) return

      const address = formatPlaceAddress(place)
      const isEstablishment = isNamedEstablishmentPlace(place.types ?? undefined)
      const venueName =
        mode === 'venue'
          ? (place.name?.trim() || '')
          : (resolveVenueNameFromAddressPick({
              placeName: place.name ?? '',
              formattedAddress: address,
              isEstablishment,
            }) ?? '')

      if (mode === 'venue') {
        onChange(venueName)
      } else {
        onChange(address)
      }

      onPlaceSelect({
        address,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        name: venueName || place.name?.trim() || '',
        cityId: resolveCityIdFromPlace(place, address),
        isEstablishment,
        postalCode: pickAddressComponent(place.address_components, 'postal_code'),
        country: pickAddressComponent(place.address_components, 'country'),
        preferVenueName: mode === 'venue',
      })
    },
    [mode, onChange, onPlaceSelect]
  )

  const { inputRef, placesReady, apiLoaded } = useGooglePlacesAutocompleteWidget({
    mode,
    cityId,
    onPlaceChanged: handlePlaceChanged,
    onApiStatus: reportPlacesApi,
  })

  useEffect(() => {
    const input = inputRef.current
    if (!input || input.value === value) return
    input.value = value
  }, [value, inputRef])

  const waitingForPlaces = apiLoaded && !placesReady

  const placeholder =
    !apiLoaded || waitingForPlaces
      ? mode === 'venue'
        ? `Enter venue name near ${city.label}…`
        : `Enter address manually near ${city.label}…`
      : mode === 'venue'
        ? `Search venues near ${city.label}…`
        : `Search address near ${city.label}…`

  return (
    <div className="relative space-y-1">
      <Label htmlFor={id} className={WIZARD_FIELD_LABEL}>
        {label}
      </Label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          key={`${id}-${cityId}`}
          defaultValue={value}
          onInput={(e) => onChange(e.currentTarget.value)}
          placeholder={placeholder}
          className={cn(
            WIZARD_INPUT,
            'flex h-10 w-full min-w-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors',
            'whitespace-normal break-words pr-9',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          )}
          aria-autocomplete="list"
          autoComplete="off"
        />
        {waitingForPlaces ? (
          <Loader2
            className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground pointer-events-none"
            aria-hidden
          />
        ) : null}
      </div>
      {!placesReady && apiLoaded ? (
        <p className="text-xs text-muted-foreground">Loading place suggestions…</p>
      ) : null}
    </div>
  )
}
