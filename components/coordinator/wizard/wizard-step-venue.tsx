'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  APIProvider,
  Map,
  AdvancedMarker,
  type MapMouseEvent,
  useApiIsLoaded,
} from '@vis.gl/react-google-maps'
import { MapPin } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { EdmontonVenueTemplateBar } from '@/components/coordinator/edmonton-venue-template-bar'
import type { EdmontonQuadrantFilter } from '@/lib/booth-planner/edmonton-venue-registry'
import type { VenuePresetId } from '@/lib/booth-planner/venue-presets'
import { resolveTemplateAnchoredDimensions } from '@/lib/booth-planner/venue-presets'
import { marketStatusBadge } from '@/lib/theme/market'
import {
  WIZARD_CALLOUT,
  WIZARD_FIELD_LABEL,
  WIZARD_INFO_BOX,
  WIZARD_INPUT,
  WIZARD_PANEL_INNER,
  WIZARD_STEP_TITLE,
} from '@/lib/wizard/wizard-panel-styles'
import { cn } from '@/lib/utils'

interface PlaceResult {
  address: string
  lat: number
  lng: number
  name: string
}

function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
}: {
  value: string
  onChange: (v: string) => void
  onPlaceSelect: (place: PlaceResult) => void
}) {
  const apiLoaded = useApiIsLoaded()
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null)

  useEffect(() => {
    if (apiLoaded && window.google?.maps?.places) {
      serviceRef.current = new window.google.maps.places.AutocompleteService()
    }
  }, [apiLoaded])

  useEffect(() => {
    if (!serviceRef.current || !value || value.length < 3) {
      setPredictions([])
      return
    }
    serviceRef.current.getPlacePredictions(
      { input: value, componentRestrictions: { country: ['ca'] } },
      (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results)
          setOpen(true)
        } else {
          setPredictions([])
        }
      }
    )
  }, [value])

  function selectPrediction(prediction: google.maps.places.AutocompletePrediction) {
    setOpen(false)
    setPredictions([])
    onChange(prediction.description)

    const mapDiv = document.createElement('div')
    const placesService = new window.google.maps.places.PlacesService(mapDiv)
    placesService.getDetails(
      { placeId: prediction.place_id, fields: ['formatted_address', 'geometry', 'name'] },
      (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          onPlaceSelect({
            address: place.formatted_address ?? prediction.description,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            name: place.name ?? '',
          })
        }
      }
    )
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search address in Edmonton area…"
        className={cn(WIZARD_INPUT, 'w-full min-w-[200px] h-auto whitespace-normal break-words py-2')}
      />
      {open && predictions.length > 0 ? (
        <ul className="absolute z-20 mt-1 w-full rounded-lg border-2 border-stone-200 bg-card shadow-[var(--shadow-market)] max-h-48 overflow-y-auto">
          {predictions.map((p) => (
            <li key={p.place_id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm whitespace-normal break-words hover:bg-canvas"
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
}: {
  venueName: string
  address: string
}) {
  const [hovered, setHovered] = useState(false)
  const displayName = venueName.trim() || 'Venue location'
  const displayAddress = address.trim() || 'Edmonton, AB'
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
  cityQuadrant: EdmontonQuadrantFilter
  onCityQuadrantChange: (quadrant: EdmontonQuadrantFilter) => void
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
}

export function WizardStepVenue({
  venuePresetId,
  onVenuePresetChange,
  cityQuadrant,
  onCityQuadrantChange,
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
}: WizardStepVenueProps) {
  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      if (!e.detail?.latLng) return
      onCoordinatesChange(e.detail.latLng.lat, e.detail.latLng.lng)
      onPinDroppedChange(true)
    },
    [onCoordinatesChange, onPinDroppedChange]
  )

  const anchor = resolveTemplateAnchoredDimensions(venuePresetId, venueWidth, venueLength)
  const markerTitle = `🏢 ${locationName.trim() || 'Venue location'}\n📍 ${address.trim() || 'Edmonton, AB'}`

  return (
    <div className={WIZARD_PANEL_INNER}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={WIZARD_STEP_TITLE}>
          {skipVenueLayout ? 'Step 2 — Venue Location' : 'Step 2 — Edmonton Venue Registry & Map'}
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
          Choose an Edmonton venue below to auto-fill the name and address, or type them in and drop a map pin.
        </p>
      ) : null}

      <EdmontonVenueTemplateBar
        value={venuePresetId}
        onChange={onVenuePresetChange}
        quadrant={cityQuadrant}
        onQuadrantChange={onCityQuadrantChange}
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
            onPlaceSelect={(place) => {
              onAddressChange(place.address)
              onCoordinatesChange(place.lat, place.lng)
              onPinDroppedChange(true)
              if (!locationName.trim()) onLocationNameChange(place.name)
            }}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5" />
        {skipVenueLayout
          ? 'Select a venue template to auto-fill details, or search the address and click the map to drop a pin.'
          : 'Click the map or pick a venue template to drop a pin immediately.'}
      </p>

      <div className="h-72 rounded-lg overflow-hidden border-2 border-stone-200">
        <Map
          mapId="wizard-venue-map"
          defaultCenter={{ lat, lng }}
          center={{ lat, lng }}
          defaultZoom={pinDropped ? 14 : 11}
          gestureHandling="greedy"
          disableDefaultUI
          onClick={handleMapClick}
          className="w-full h-full cursor-crosshair"
        >
          {pinDropped ? (
            <AdvancedMarker position={{ lat, lng }} title={markerTitle} zIndex={9999}>
              <VenueMapPin venueName={locationName} address={address} />
            </AdvancedMarker>
          ) : null}
        </Map>
      </div>
    </div>
  )
}

export function WizardStepVenueWithMapsProvider(props: WizardStepVenueProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''
  if (!apiKey) {
    return (
      <div className={WIZARD_PANEL_INNER}>
        <p className="text-sm text-destructive">Google Maps API key is not configured.</p>
      </div>
    )
  }
  return (
    <APIProvider apiKey={apiKey}>
      <WizardStepVenue {...props} />
    </APIProvider>
  )
}
