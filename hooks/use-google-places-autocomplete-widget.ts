'use client'

import { useApiIsLoaded, useMapsLibrary } from '@vis.gl/react-google-maps'
import { useEffect, useRef, useState } from 'react'
import { marketCityLatLngBoundsLiteral } from '@/lib/wizard/wizard-places-bounds'
import type { WizardPlacesAutocompleteMode } from '@/lib/wizard/wizard-place-types'

export interface UseGooglePlacesAutocompleteWidgetOptions {
  mode: WizardPlacesAutocompleteMode
  cityId: string
  /** Called when user picks a place from the Google dropdown (`place_changed`). */
  onPlaceChanged: (place: google.maps.places.PlaceResult) => void
  onApiStatus?: (success: boolean) => void
}

/**
 * Attaches `google.maps.places.Autocomplete` to an input element after the Places
 * library is loaded via APIProvider `libraries={['places']}`.
 */
export function useGooglePlacesAutocompleteWidget({
  mode,
  cityId,
  onPlaceChanged,
  onApiStatus,
}: UseGooglePlacesAutocompleteWidgetOptions) {
  const apiLoaded = useApiIsLoaded()
  const placesLib = useMapsLibrary('places')
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const listenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const onPlaceChangedRef = useRef(onPlaceChanged)
  onPlaceChangedRef.current = onPlaceChanged

  const [ready, setReady] = useState(false)

  useEffect(() => {
    const input = inputRef.current
    if (!apiLoaded || !placesLib || !input) {
      setReady(false)
      return
    }

    if (listenerRef.current) {
      google.maps.event.removeListener(listenerRef.current)
      listenerRef.current = null
    }
    autocompleteRef.current = null

    const bounds = marketCityLatLngBoundsLiteral(cityId)
    const options: google.maps.places.AutocompleteOptions = {
      bounds,
      strictBounds: false,
      componentRestrictions: { country: 'ca' },
      fields: [
        'formatted_address',
        'geometry',
        'name',
        'types',
        'address_components',
      ],
    }

    if (mode === 'venue') {
      options.types = ['establishment']
    }

    try {
      const autocomplete = new placesLib.Autocomplete(input, options)
      autocompleteRef.current = autocomplete

      listenerRef.current = autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace()
        if (!place?.geometry?.location) return
        onApiStatus?.(true)
        onPlaceChangedRef.current(place)
      })

      setReady(true)
      onApiStatus?.(true)
    } catch {
      setReady(false)
      onApiStatus?.(false)
    }

    return () => {
      if (listenerRef.current) {
        google.maps.event.removeListener(listenerRef.current)
        listenerRef.current = null
      }
      autocompleteRef.current = null
      setReady(false)
    }
  }, [apiLoaded, cityId, mode, onApiStatus, placesLib])

  useEffect(() => {
    const ac = autocompleteRef.current
    if (!ac || !placesLib) return
    try {
      ac.setBounds(marketCityLatLngBoundsLiteral(cityId))
    } catch {
      /* ignore */
    }
  }, [cityId, placesLib])

  return {
    inputRef,
    placesReady: ready && Boolean(placesLib),
    apiLoaded,
  }
}
