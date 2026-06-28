'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { GoogleMapsProvider } from '@/components/map/google-maps-provider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  fetchPlaceDetailsSafe,
  usePlacesAutocomplete,
} from '@/hooks/use-places-autocomplete'
import { cn } from '@/lib/utils'

export interface HomeAddressSelection {
  lat: number
  lng: number
  label: string
}

interface HomeAddressPickerProps {
  id?: string
  label?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  onSelect: (selection: HomeAddressSelection) => void
}

const CANADA_CENTER = { lat: 53.5461, lng: -113.4938 }

function geocodeAddressFallback(address: string): Promise<HomeAddressSelection | null> {
  return new Promise((resolve) => {
    if (!window.google?.maps?.Geocoder) {
      resolve(null)
      return
    }
    const geocoder = new window.google.maps.Geocoder()
    geocoder.geocode(
      { address, componentRestrictions: { country: 'ca' } },
      (results, status) => {
        if (status !== 'OK' || !results?.[0]?.geometry?.location) {
          resolve(null)
          return
        }
        const loc = results[0].geometry.location
        resolve({
          lat: loc.lat(),
          lng: loc.lng(),
          label: results[0].formatted_address ?? address,
        })
      }
    )
  })
}

async function geocodeViaServer(query: string): Promise<HomeAddressSelection | null> {
  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { lat?: number; lng?: number; label?: string }
    if (
      data.lat == null ||
      data.lng == null ||
      !Number.isFinite(data.lat) ||
      !Number.isFinite(data.lng)
    ) {
      return null
    }
    return { lat: data.lat, lng: data.lng, label: data.label ?? query }
  } catch {
    return null
  }
}

function HomeAddressPickerInner({
  id,
  label = 'Home address',
  placeholder = 'Start typing your address…',
  className,
  disabled,
  onSelect,
}: HomeAddressPickerProps) {
  const listboxId = useId()
  const [input, setInput] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const buildRequest = useCallback(
    (): google.maps.places.AutocompletionRequest => ({
      input,
      types: ['address'],
      componentRestrictions: { country: 'ca' },
    }),
    [input]
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
  } = usePlacesAutocomplete({ input, buildRequest, minLength: 3 })

  async function selectPrediction(placeId: string, description: string) {
    setError(null)
    setGeocoding(true)
    const place = await fetchPlaceDetailsSafe(placeId, [
      'geometry',
      'formatted_address',
    ])
    setGeocoding(false)

    const lat = place?.geometry?.location?.lat()
    const lng = place?.geometry?.location?.lng()
    if (lat == null || lng == null) {
      setError('Could not read coordinates for that address. Try another result.')
      return
    }

    const resolvedLabel = place?.formatted_address ?? description
    setInput(resolvedLabel)
    clearPredictions()
    onSelect({ lat, lng, label: resolvedLabel })
  }

  async function geocodeManual() {
    const trimmed = input.trim()
    if (trimmed.length < 3) {
      setError('Enter at least 3 characters for your address or postal code.')
      return
    }
    setError(null)
    setGeocoding(true)
    const result = (await geocodeViaServer(trimmed)) ?? (await geocodeAddressFallback(trimmed))
    setGeocoding(false)
    if (!result) {
      setError('Could not find that address. Check spelling or try a postal code.')
      return
    }
    setInput(result.label)
    clearPredictions()
    onSelect(result)
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={inputRef}
          id={id}
          value={input}
          disabled={disabled || geocoding}
          placeholder={placeholder}
          className="border-2 border-stone-300 bg-white pl-9 pr-10 text-base font-medium text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:border-forest focus-visible:ring-2 focus-visible:ring-forest/25"
          autoComplete="street-address"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onChange={(e) => {
            setInput(e.target.value)
            setError(null)
          }}
          onKeyDown={(e) => {
            if (!open || predictions.length === 0) {
              if (e.key === 'Enter') {
                e.preventDefault()
                void geocodeManual()
              }
              return
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHighlightIndex((i) => Math.min(i + 1, predictions.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlightIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && highlightIndex >= 0) {
              e.preventDefault()
              const pick = predictions[highlightIndex]
              if (pick) void selectPrediction(pick.place_id, pick.description)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150)
          }}
          onFocus={() => {
            if (predictions.length > 0) setOpen(true)
          }}
        />
        {(loading || geocoding) && (
          <Loader2
            className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
        {open && predictions.length > 0 ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-white py-1 shadow-lg"
          >
            {predictions.map((prediction, index) => (
              <li key={prediction.place_id} role="option" aria-selected={index === highlightIndex}>
                <button
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-canvas',
                    index === highlightIndex && 'bg-canvas'
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() =>
                    void selectPrediction(prediction.place_id, prediction.description)
                  }
                >
                  {prediction.description}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {apiUnavailable ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">
            Address search unavailable — enter a postal code instead.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-9"
            disabled={disabled || geocoding}
            onClick={() => void geocodeManual()}
          >
            Find address
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  )
}

export function HomeAddressPicker(props: HomeAddressPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? ''
  const pickerId = props.id ?? 'home-address'

  if (!apiKey) {
    return (
      <div className={cn('space-y-2', props.className)}>
        <p className="text-xs text-muted-foreground">
          Address autocomplete is unavailable. Enter your address or postal code, then press Enter.
        </p>
        <HomeAddressPickerInner {...props} id={pickerId} />
      </div>
    )
  }

  return (
    <GoogleMapsProvider
      apiKey={apiKey}
      libraries={['places']}
      loading={
        <>
          <HomeAddressPickerInner {...props} id={pickerId} />
          <p className="text-xs text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Loading address suggestions — you can still type and press Enter.
          </p>
        </>
      }
      fallback={
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Address autocomplete is unavailable. Enter your address or postal code, then press Enter.
          </p>
          <HomeAddressPickerInner {...props} id={pickerId} />
        </div>
      }
    >
      <HomeAddressPickerInner {...props} id={pickerId} />
    </GoogleMapsProvider>
  )
}

export { CANADA_CENTER }
