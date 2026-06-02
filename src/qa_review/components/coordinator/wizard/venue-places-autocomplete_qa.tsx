'use client'

import { usePlacesApiStatus } from '@/components/coordinator/floor-plan-v2/debug/places-api-status-context'
import { useApiIsLoaded } from '@vis.gl/react-google-maps'
import { Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fetchPlaceDetailsSafe,
  usePlacesAutocomplete,
} from '@/hooks/use-places-autocomplete'
import { getMarketCityById } from '@/lib/wizard/market-cities'
import {
  isNamedEstablishmentPlace,
  resolveVenueNameForPlace,
} from '@/lib/wizard/google-place-venue'
import { WIZARD_FIELD_LABEL, WIZARD_INPUT } from '@/lib/wizard/wizard-panel-styles'
import { cn } from '@/lib/utils'
import {
  buildWizardPlacesAutocompleteRequest,
  type WizardPlacesAutocompleteMode,
} from '@/src/qa_review/lib/wizard/places-autocomplete-request_qa'
import {
  MARKET_CITIES,
  inferMarketCityId,
} from '@/lib/wizard/market-cities'
import type { PlaceResult } from '@/src/qa_review/components/coordinator/wizard/wizard-place-types_qa'

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
  fallbackAddress: string,
  inferMarketCityId: (address: string) => string
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
  currentVenueName: string
  onPlaceSelect: (place: PlaceResult) => void
  /** Floating label variant (venue name row). */
  variant?: 'floating' | 'stacked'
}

export function VenuePlacesAutocomplete({
  id,
  mode,
  label,
  value,
  onChange,
  cityId,
  currentVenueName,
  onPlaceSelect,
  variant = 'stacked',
}: VenuePlacesAutocompleteProps) {
  const { reportPlacesApi } = usePlacesApiStatus()
  const apiLoaded = useApiIsLoaded()
  const city = getMarketCityById(cityId)
  const containerRef = useRef<HTMLDivElement>(null)
  const listId = `${id}-predictions`

  const buildRequest = useCallback(
    () => buildWizardPlacesAutocompleteRequest(value, cityId, mode),
    [cityId, mode, value]
  )

  const {
    predictions,
    open,
    setOpen,
    loading,
    apiUnavailable,
    highlightIndex,
    setHighlightIndex,
    clearPredictions,
  } = usePlacesAutocomplete({
    input: value,
    minLength: mode === 'venue' ? 2 : 3,
    buildRequest,
    onApiStatus: reportPlacesApi,
  })

  const selectPrediction = useCallback(
    async (prediction: google.maps.places.AutocompletePrediction) => {
      setOpen(false)
      clearPredictions()

      const display =
        mode === 'venue'
          ? prediction.structured_formatting.main_text
          : prediction.description
      onChange(display)

      const place = await fetchPlaceDetailsSafe(prediction.place_id, [
        'formatted_address',
        'geometry',
        'name',
        'types',
        'address_components',
      ])
      if (!place?.geometry?.location) return

      const address = place.formatted_address ?? prediction.description
      const isEstablishment = isNamedEstablishmentPlace(place.types ?? undefined)

      const venueName =
        mode === 'venue'
          ? (place.name?.trim() ||
              prediction.structured_formatting.main_text ||
              resolveVenueNameForPlace({
                placeName: place.name ?? '',
                formattedAddress: address,
                isEstablishment,
                currentVenueName: '',
              }) ||
              '')
          : (resolveVenueNameForPlace({
              placeName: place.name ?? '',
              formattedAddress: address,
              isEstablishment,
              currentVenueName,
            }) ?? place.name ?? '')

      onPlaceSelect({
        address,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        name: venueName,
        cityId: resolveCityIdFromPlace(place, address, inferMarketCityId),
        isEstablishment,
        postalCode: pickAddressComponent(place.address_components, 'postal_code'),
        country: pickAddressComponent(place.address_components, 'country'),
        preferVenueName: mode === 'venue',
      })
    },
    [
      cityId,
      clearPredictions,
      currentVenueName,
      mode,
      onChange,
      onPlaceSelect,
      setOpen,
    ]
  )

  useEffect(() => {
    function handleClickOutside(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [setHighlightIndex, setOpen])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || predictions.length === 0) {
      if (e.key === 'Escape') setOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev + 1) % predictions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((prev) => (prev <= 0 ? predictions.length - 1 : prev - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = highlightIndex >= 0 ? predictions[highlightIndex] : predictions[0]
      if (target) void selectPrediction(target)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setHighlightIndex(-1)
    }
  }

  const placeholder =
    !apiLoaded || apiUnavailable
      ? mode === 'venue'
        ? `Enter venue name near ${city.label}…`
        : `Enter address manually near ${city.label}…`
      : mode === 'venue'
        ? `Search venues near ${city.label}…`
        : `Search address near ${city.label}…`

  const inputEl = (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (predictions.length > 0) setOpen(true)
        }}
        placeholder={placeholder}
        className={cn(WIZARD_INPUT, 'w-full min-w-[200px] h-auto whitespace-normal break-words py-2 pr-9')}
        aria-autocomplete="list"
        aria-expanded={open && predictions.length > 0}
        aria-controls={listId}
        role="combobox"
        autoComplete="off"
      />
      {loading ? (
        <Loader2
          className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground pointer-events-none"
          aria-hidden
        />
      ) : null}
    </div>
  )

  return (
    <div ref={containerRef} className="relative space-y-1">
      {variant === 'floating' ? (
        <div className="relative">
          <Label htmlFor={id} className={cn(WIZARD_FIELD_LABEL, 'sr-only')}>
            {label}
          </Label>
          <span className="pointer-events-none absolute left-3 top-2 z-10 text-xs font-medium text-muted-foreground">
            {label}
          </span>
          <div className="pt-5">{inputEl}</div>
        </div>
      ) : (
        <>
          <Label htmlFor={id} className={WIZARD_FIELD_LABEL}>
            {label}
          </Label>
          {inputEl}
        </>
      )}
      {open && predictions.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="wizard-select-content absolute z-20 mt-1 w-full rounded-lg border border-white/60 bg-card/95 backdrop-blur-md shadow-[var(--shadow-market)] max-h-48 overflow-y-auto"
        >
          {predictions.map((p, index) => (
            <li key={p.place_id} role="option" aria-selected={index === highlightIndex}>
              <button
                type="button"
                className={cn(
                  'w-full text-left px-3 py-2 text-sm whitespace-normal break-words hover:bg-canvas',
                  index === highlightIndex && 'bg-canvas'
                )}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => void selectPrediction(p)}
              >
                <span className="font-medium">{p.structured_formatting.main_text}</span>
                {p.structured_formatting.secondary_text ? (
                  <span className="text-muted-foreground block text-xs">
                    {p.structured_formatting.secondary_text}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
