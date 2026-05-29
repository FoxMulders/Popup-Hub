'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  APIProvider,
  Map,
  AdvancedMarker,
  type MapMouseEvent,
  useApiIsLoaded,
} from '@vis.gl/react-google-maps'
import { MapRecenter } from '@/components/map/map-recenter'
import { Loader2, MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { EdmontonVenueTemplateBar } from '@/components/coordinator/edmonton-venue-template-bar'
import type { VenuePresetId } from '@/lib/booth-planner/venue-presets'
import { resolveTemplateAnchoredDimensions } from '@/lib/booth-planner/venue-presets'
import { marketStatusBadge } from '@/lib/theme/market'
import {
  MARKET_CITIES,
  getMarketCityById,
  inferMarketCityId,
  isEdmontonMarketCity,
} from '@/lib/wizard/market-cities'
import {
  WIZARD_CALLOUT,
  WIZARD_FIELD_LABEL,
  WIZARD_INFO_BOX,
  WIZARD_INPUT,
  WIZARD_PANEL_INNER,
  WIZARD_STEP_TITLE,
} from '@/lib/wizard/wizard-panel-styles'
import { cn } from '@/lib/utils'
import {
  isNamedEstablishmentPlace,
  resolveVenueNameFromGeocoderResult,
} from '@/lib/wizard/google-place-venue'
import type { CoordinatorSavedVenue } from '@/types/database'

export interface PlaceResult {
  address: string
  lat: number
  lng: number
  name: string
  /** Market-city ID inferred from the place's address components. */
  cityId: string | null
  /** Whether the picked place is a named establishment (not a bare street address). */
  isEstablishment: boolean
  postalCode: string | null
  country: string | null
}

function pickAddressComponent(
  components: google.maps.GeocoderAddressComponent[] | undefined,
  type: string
): string | null {
  if (!components) return null
  const match = components.find((c) => c.types.includes(type))
  return match?.long_name ?? null
}

/**
 * Resolve the inferred market city ID from the picked place. We prefer
 * structured `address_components` (locality / administrative_area) and only
 * fall back to fuzzy string match on the formatted address — that way a
 * "Chinook Centre, Calgary" pick reliably switches the wizard from Edmonton
 * even if the formatted_address opens with the venue name.
 */
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

  // Fall back to the existing formatted-address heuristic.
  const text = place.formatted_address ?? fallbackAddress
  if (!text.trim()) return null
  return inferMarketCityId(text)
}

function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  cityId,
}: {
  value: string
  onChange: (v: string) => void
  onPlaceSelect: (place: PlaceResult) => void
  cityId: string
}) {
  const apiLoaded = useApiIsLoaded()
  const city = getMarketCityById(cityId)
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (apiLoaded && window.google?.maps?.places) {
      serviceRef.current = new window.google.maps.places.AutocompleteService()
      const mapDiv = document.createElement('div')
      placesServiceRef.current = new window.google.maps.places.PlacesService(mapDiv)
    }
  }, [apiLoaded])

  useEffect(() => {
    if (!serviceRef.current || !value || value.length < 3) {
      setPredictions([])
      setOpen(false)
      setLoading(false)
      setHighlightIndex(-1)
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLoading(true)

    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current
      serviceRef.current!.getPlacePredictions(
        {
          input: value,
          componentRestrictions: { country: ['ca'] },
          locationBias: {
            center: { lat: city.lat, lng: city.lng },
            radius: 50000,
          },
        },
        (results, status) => {
          if (requestId !== requestIdRef.current) return
          setLoading(false)
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
            setPredictions(results)
            setOpen(true)
            setHighlightIndex(-1)
          } else {
            setPredictions([])
            setOpen(false)
            setHighlightIndex(-1)
          }
        }
      )
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value, city.lat, city.lng])

  const selectPrediction = useCallback(
    (prediction: google.maps.places.AutocompletePrediction) => {
      setOpen(false)
      setPredictions([])
      setHighlightIndex(-1)
      onChange(prediction.description)

      if (!placesServiceRef.current) return

      placesServiceRef.current.getDetails(
        {
          placeId: prediction.place_id,
          fields: [
            'formatted_address',
            'geometry',
            'name',
            'types',
            'address_components',
          ],
        },
        (place, status) => {
          if (status !== window.google.maps.places.PlacesServiceStatus.OK || !place?.geometry?.location) {
            return
          }
          const address = place.formatted_address ?? prediction.description
          const isEstablishment = isNamedEstablishmentPlace(place.types ?? undefined)
          onPlaceSelect({
            address,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            name: place.name ?? '',
            cityId: resolveCityIdFromPlace(place, address),
            isEstablishment,
            postalCode: pickAddressComponent(place.address_components, 'postal_code'),
            country: pickAddressComponent(place.address_components, 'country'),
          })
        }
      )
    },
    [onChange, onPlaceSelect]
  )

  useEffect(() => {
    // PointerDown unifies mouse, touch and pen so a tap outside the
    // autocomplete dropdown closes it on mobile too. Falling back to
    // `mousedown` for browsers that pre-date Pointer Events would only
    // matter for legacy IE — every supported browser ships PointerEvents.
    function handleClickOutside(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setHighlightIndex(-1)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [])

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
      if (target) selectPrediction(target)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      setHighlightIndex(-1)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (predictions.length > 0) setOpen(true)
          }}
          placeholder={`Search address near ${city.label}…`}
          className={cn(WIZARD_INPUT, 'w-full min-w-[200px] h-auto whitespace-normal break-words py-2 pr-9')}
          aria-autocomplete="list"
          aria-expanded={open && predictions.length > 0}
          aria-controls="wizard-address-predictions"
          role="combobox"
        />
        {loading ? (
          <Loader2
            className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground pointer-events-none"
            aria-hidden
          />
        ) : null}
      </div>
      {open && predictions.length > 0 ? (
        <ul
          id="wizard-address-predictions"
          role="listbox"
          className="absolute z-20 mt-1 w-full rounded-lg border-2 border-stone-200 bg-card shadow-[var(--shadow-market)] max-h-48 overflow-y-auto"
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
                onClick={() => selectPrediction(p)}
              >
                {p.description}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function VenueMapPin({
  venueName,
  address,
  cityLabel,
}: {
  venueName: string
  address: string
  cityLabel: string
}) {
  const [hovered, setHovered] = useState(false)
  const displayName = venueName.trim() || 'Venue location'
  const displayAddress = address.trim() || cityLabel
  const nativeTitle = `🏢 ${displayName}\n📍 ${displayAddress}`

  return (
    <div
      className="relative flex flex-col items-center"
      title={nativeTitle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      role="button"
      tabIndex={0}
      aria-label={`${displayName}, ${displayAddress}`}
    >
      {hovered ? (
        <div
          className={cn(
            'absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 pointer-events-none',
            'bg-black text-white text-xs border-2 border-black p-3 rounded',
            'shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] max-w-[240px] h-auto',
            'whitespace-normal break-words flex flex-col gap-1',
            'animate-in fade-in-0 zoom-in-95 duration-150'
          )}
          role="tooltip"
        >
          <p className="font-bold uppercase tracking-wide block w-full whitespace-normal break-words">
            🏢 {displayName}
          </p>
          <p className="text-muted-foreground block w-full whitespace-normal break-words leading-relaxed">
            📍 {displayAddress}
          </p>
        </div>
      ) : null}
      <div
        className="flex h-8 w-8 items-center justify-center rounded-full bg-terracotta-500 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
        title={nativeTitle}
      >
        <MapPin className="h-4 w-4 text-white" />
      </div>
    </div>
  )
}

export interface WizardStepVenueProps {
  venuePresetId: VenuePresetId
  onVenuePresetChange: (id: VenuePresetId) => void
  city: string
  onCityChange: (cityId: string) => void
  locationName: string
  onLocationNameChange: (v: string) => void
  address: string
  onAddressChange: (v: string) => void
  lat: number
  lng: number
  onCoordinatesChange: (lat: number, lng: number) => void
  pinDropped: boolean
  onPinDroppedChange: (v: boolean) => void
  venueWidth: number
  venueLength: number
  skipVenueLayout: boolean
  onSkipVenueLayoutChange: (v: boolean) => void
  coordinatorId: string
  onApplySavedVenue: (venue: CoordinatorSavedVenue) => void
  onPlaceSelect: (place: PlaceResult) => void
}

export function WizardStepVenue({
  venuePresetId,
  onVenuePresetChange,
  city,
  onCityChange,
  locationName,
  onLocationNameChange,
  address,
  onAddressChange,
  lat,
  lng,
  onCoordinatesChange,
  pinDropped,
  onPinDroppedChange,
  venueWidth,
  venueLength,
  skipVenueLayout,
  onSkipVenueLayoutChange,
  coordinatorId,
  onApplySavedVenue,
  onPlaceSelect,
}: WizardStepVenueProps) {
  const apiLoaded = useApiIsLoaded()
  const marketCity = getMarketCityById(city)
  const cityLabel = marketCity.label
  const prevCityRef = useRef(city)
  const geocoderRef = useRef<google.maps.Geocoder | null>(null)
  const locationNameRef = useRef(locationName)
  locationNameRef.current = locationName

  useEffect(() => {
    if (apiLoaded && window.google?.maps) {
      geocoderRef.current = new window.google.maps.Geocoder()
    }
  }, [apiLoaded])

  useEffect(() => {
    if (prevCityRef.current === city) return
    prevCityRef.current = city
    if (!pinDropped) {
      onCoordinatesChange(marketCity.lat, marketCity.lng)
    }
  }, [city, marketCity.lat, marketCity.lng, pinDropped, onCoordinatesChange])

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (!e.detail?.latLng) return
      const nextLat = e.detail.latLng.lat
      const nextLng = e.detail.latLng.lng
      onCoordinatesChange(nextLat, nextLng)
      onPinDroppedChange(true)

      const geocoder = geocoderRef.current
      if (!geocoder) return

      geocoder.geocode({ location: { lat: nextLat, lng: nextLng } }, (results, status) => {
        if (status !== window.google.maps.GeocoderStatus.OK || !results?.[0]) return
        const result = results[0]
        const address = result.formatted_address ?? ''
        const venueName = resolveVenueNameFromGeocoderResult(result, locationNameRef.current)
        const cityId = address ? inferMarketCityId(address) : null
        const isEstablishment = isNamedEstablishmentPlace(result.types)

        onPlaceSelect({
          address,
          lat: nextLat,
          lng: nextLng,
          name: venueName ?? '',
          cityId,
          isEstablishment,
          postalCode: pickAddressComponent(result.address_components, 'postal_code'),
          country: pickAddressComponent(result.address_components, 'country'),
        })
      })
    },
    [onCoordinatesChange, onPinDroppedChange, onPlaceSelect]
  )

  const anchor = resolveTemplateAnchoredDimensions(venuePresetId, venueWidth, venueLength)
  const displayName = locationName.trim() || 'Venue location'
  const displayAddress = address.trim() || cityLabel
  const markerTitle = `🏢 ${displayName}\n📍 ${displayAddress}`

  return (
    <div className={WIZARD_PANEL_INNER}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={WIZARD_STEP_TITLE}>
          {skipVenueLayout
            ? 'Venue Location'
            : isEdmontonMarketCity(city)
              ? 'Edmonton Venue Registry & Map'
              : `Venue Registry & Map (${cityLabel})`}
        </h2>
        {pinDropped ? (
          <Badge className={`${marketStatusBadge.success} text-xs`}>Pin dropped</Badge>
        ) : null}
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border-2 border-stone-200 bg-canvas px-4 py-3">
        <div className="space-y-1">
          <Label htmlFor="wizard-skip-layout" className={WIZARD_FIELD_LABEL}>
            No venue space planning required
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Skip the floor plan editor. Pick a venue from the registry to auto-fill name and address, or enter them
            manually.
          </p>
        </div>
        <Switch
          id="wizard-skip-layout"
          checked={skipVenueLayout}
          onCheckedChange={onSkipVenueLayoutChange}
          aria-label="Skip venue space planning"
        />
      </div>

      {skipVenueLayout ? (
        <p className={WIZARD_INFO_BOX}>
          {isEdmontonMarketCity(city)
            ? 'Choose an Edmonton venue below to auto-fill the name and address, or type them in and drop a map pin.'
            : `Enter the venue name and address for ${cityLabel}, then drop a map pin.`}
        </p>
      ) : null}

      <EdmontonVenueTemplateBar
        value={venuePresetId}
        onChange={onVenuePresetChange}
        city={city}
        onCityChange={onCityChange}
        coordinatorId={coordinatorId}
        onApplySavedVenue={onApplySavedVenue}
        locationName={locationName}
        address={address}
        lat={lat}
        lng={lng}
        pinDropped={pinDropped}
        skipVenueLayout={skipVenueLayout}
      />

      {anchor.isAnchored && anchor.preset && !skipVenueLayout ? (
        <p className={WIZARD_CALLOUT}>
          Template locked: {anchor.preset.label} — {anchor.width}′ × {anchor.length}′ (
          {(anchor.width * anchor.length).toLocaleString()} sq ft)
        </p>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="wizard-loc-name" className={WIZARD_FIELD_LABEL}>Venue Name</Label>
          <Input
            id="wizard-loc-name"
            value={locationName}
            onChange={(e) => onLocationNameChange(e.target.value)}
            className={WIZARD_INPUT}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="wizard-address" className={WIZARD_FIELD_LABEL}>Address</Label>
          <AddressAutocomplete
            value={address}
            onChange={onAddressChange}
            cityId={city}
            onPlaceSelect={onPlaceSelect}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5" />
        {skipVenueLayout
          ? 'Select a venue template to auto-fill details, or search the address and click the map to drop a pin.'
          : 'Click the map or pick a venue template to drop a pin immediately.'}
      </p>

      <div
        id="wizard-venue-map"
        className="h-72 overflow-hidden rounded-lg border-2 border-stone-200 [touch-action:auto]"
        tabIndex={-1}
      >
        <Map
          mapId="wizard-venue-map-canvas"
          defaultCenter={{ lat, lng }}
          defaultZoom={pinDropped ? 14 : 11}
          gestureHandling="greedy"
          disableDefaultUI
          onClick={handleMapClick}
          className="h-full w-full cursor-crosshair"
        >
          <MapRecenter lat={lat} lng={lng} pinDropped={pinDropped} zoomOnPinDrop />
          {pinDropped ? (
            <AdvancedMarker position={{ lat, lng }} title={markerTitle} zIndex={9999}>
              <VenueMapPin venueName={locationName} address={address} cityLabel={cityLabel} />
            </AdvancedMarker>
          ) : null}
        </Map>
      </div>
    </div>
  )
}

/**
 * Plain-form fallback shown when `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is missing
 * from the environment. We still render the venue name + address inputs and
 * let the coordinator advance — the map / typeahead simply degrade so a
 * misconfigured Vercel env doesn't hard-block the wizard.
 */
function WizardStepVenueFallback({
  locationName,
  onLocationNameChange,
  address,
  onAddressChange,
  city,
  cityLabel,
  skipVenueLayout,
  onSkipVenueLayoutChange,
}: {
  locationName: string
  onLocationNameChange: (v: string) => void
  address: string
  onAddressChange: (v: string) => void
  city: string
  cityLabel: string
  skipVenueLayout: boolean
  onSkipVenueLayoutChange: (v: boolean) => void
}) {
  return (
    <div className={WIZARD_PANEL_INNER}>
      <h2 className={WIZARD_STEP_TITLE}>Venue Location</h2>
      <p className={cn(WIZARD_INFO_BOX, 'text-sm text-amber-900')}>
        Map autocomplete is offline (Google Maps API key not configured). Enter the venue name and
        address by hand — coordinates will fall back to the {cityLabel} city centre.
      </p>
      <div className="flex items-start justify-between gap-4 rounded-lg border-2 border-stone-200 bg-canvas px-4 py-3">
        <div className="space-y-1">
          <Label htmlFor="wizard-skip-layout" className={WIZARD_FIELD_LABEL}>
            No venue space planning required
          </Label>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Skip the floor plan editor. Enter the venue name and address manually.
          </p>
        </div>
        <Switch
          id="wizard-skip-layout"
          checked={skipVenueLayout}
          onCheckedChange={onSkipVenueLayoutChange}
          aria-label="Skip venue space planning"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="wizard-loc-name" className={WIZARD_FIELD_LABEL}>
            Venue Name
          </Label>
          <Input
            id="wizard-loc-name"
            value={locationName}
            onChange={(e) => onLocationNameChange(e.target.value)}
            className={WIZARD_INPUT}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="wizard-address" className={WIZARD_FIELD_LABEL}>
            Address
          </Label>
          <Input
            id="wizard-address"
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder={`Street address near ${cityLabel}`}
            className={WIZARD_INPUT}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground" aria-hidden="true">
        Selected market city: {cityLabel} ({city})
      </p>
    </div>
  )
}

export function WizardStepVenueWithMapsProvider(props: WizardStepVenueProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  if (!apiKey) {
    const cityLabel = getMarketCityById(props.city).label
    return (
      <WizardStepVenueFallback
        locationName={props.locationName}
        onLocationNameChange={props.onLocationNameChange}
        address={props.address}
        onAddressChange={props.onAddressChange}
        city={props.city}
        cityLabel={cityLabel}
        skipVenueLayout={props.skipVenueLayout}
        onSkipVenueLayoutChange={props.onSkipVenueLayoutChange}
      />
    )
  }
  return (
    <APIProvider apiKey={apiKey}>
      <WizardStepVenue {...props} />
    </APIProvider>
  )
}
