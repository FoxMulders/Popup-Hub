'use client'

import '@/src/qa_review/styles/wizard-places-autocomplete_qa.css'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Map,
  AdvancedMarker,
  type MapMouseEvent,
  useApiIsLoaded,
} from '@vis.gl/react-google-maps'
import { WizardPlacesApiProviderQa } from '@/src/qa_review/components/coordinator/wizard/wizard-places-api-provider_qa'
import { MapRecenter } from '@/components/map/map-recenter'
import { MapPin } from 'lucide-react'
import {
  WizardFloatingInput,
  WizardMapContainer,
  WizardSwitchRow,
  WizardZone,
} from '@/components/coordinator/wizard/wizard-ui'
import { VenuePlacesAutocomplete } from '@/src/qa_review/components/coordinator/wizard/venue-places-autocomplete_qa'
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
  WIZARD_INFO_BOX,
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
    <WizardZone
      id="wizard-zone-venue"
      title={
        skipVenueLayout
          ? 'Venue location'
          : isEdmontonMarketCity(city)
            ? 'Edmonton venue & map'
            : `Venue & map (${cityLabel})`
      }
      subtitle="Search venue name or address — both fields predict from Google Places and update the map pin."
    >
      <div className="flex flex-wrap items-center justify-end gap-2 -mt-2 mb-1">
        {pinDropped ? (
          <Badge className={`${marketStatusBadge.success} text-xs`}>Location locked</Badge>
        ) : null}
      </div>

      <WizardSwitchRow
        id="wizard-skip-layout"
        label="No venue space planning required"
        description="Skip the floor plan editor. Pick a venue from the registry to auto-fill name and address, or enter them manually."
        control={
          <Switch
            id="wizard-skip-layout"
            checked={skipVenueLayout}
            onCheckedChange={onSkipVenueLayoutChange}
            aria-label="Skip venue space planning"
          />
        }
      />

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
        <VenuePlacesAutocomplete
          id="wizard-loc-name"
          mode="venue"
          label="Venue Name"
          value={locationName}
          onChange={onLocationNameChange}
          cityId={city}
          currentVenueName={locationName}
          onPlaceSelect={onPlaceSelect}
        />
        <VenuePlacesAutocomplete
          id="wizard-address"
          mode="address"
          label="Address"
          value={address}
          onChange={onAddressChange}
          cityId={city}
          currentVenueName={locationName}
          onPlaceSelect={onPlaceSelect}
        />
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5" />
        {skipVenueLayout
          ? 'Search venue or address for predictions, or click the map to drop a pin.'
          : 'Search venue or address, click the map, or pick a venue template to set the pin.'}
      </p>

      <WizardMapContainer id="wizard-venue-map" pinDropped={pinDropped} tabIndex={-1}>
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
      </WizardMapContainer>
    </WizardZone>
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
    <WizardZone
      id="wizard-zone-venue"
      title="Venue location"
      subtitle="Maps autocomplete is offline — enter name and address manually."
    >
      <p className={cn(WIZARD_INFO_BOX, 'text-sm text-amber-900')}>
        Coordinates will fall back to the {cityLabel} city centre until a pin is set.
      </p>
      <WizardSwitchRow
        id="wizard-skip-layout"
        label="No venue space planning required"
        description="Skip the floor plan editor. Enter the venue name and address manually."
        control={
          <Switch
            id="wizard-skip-layout"
            checked={skipVenueLayout}
            onCheckedChange={onSkipVenueLayoutChange}
            aria-label="Skip venue space planning"
          />
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <WizardFloatingInput
          id="wizard-loc-name"
          label="Venue Name"
          value={locationName}
          onChange={(e) => onLocationNameChange(e.target.value)}
        />
        <WizardFloatingInput
          id="wizard-address"
          label="Address"
          value={address}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder={`Street address near ${cityLabel}`}
        />
      </div>
      <p className="text-xs text-muted-foreground" aria-hidden="true">
        Selected market city: {cityLabel} ({city})
      </p>
    </WizardZone>
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
    <WizardPlacesApiProviderQa apiKey={apiKey}>
      <WizardStepVenue {...props} />
    </WizardPlacesApiProviderQa>
  )
}
