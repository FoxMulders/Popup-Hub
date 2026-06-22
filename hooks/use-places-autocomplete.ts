'use client'

import { useApiIsLoaded } from '@vis.gl/react-google-maps'
import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_DEBOUNCE_MS = 500

export interface UsePlacesAutocompleteOptions {
  input: string
  minLength?: number
  debounceMs?: number
  /** Return null to skip a fetch (e.g. missing bias). */
  buildRequest: () => google.maps.places.AutocompletionRequest | null
  /** Diagnostic footer — `API_SUCCESS` / `API_ERROR`. */
  onApiStatus?: (success: boolean) => void
}

export function usePlacesAutocomplete({
  input,
  minLength = 3,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  buildRequest,
  onApiStatus,
}: UsePlacesAutocompleteOptions) {
  const apiLoaded = useApiIsLoaded()
  const [predictions, setPredictions] = useState<
    google.maps.places.AutocompletePrediction[]
  >([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [apiUnavailable, setApiUnavailable] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(-1)

  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    try {
      if (apiLoaded && window.google?.maps?.places) {
        serviceRef.current = new window.google.maps.places.AutocompleteService()
        setApiUnavailable(false)
      }
    } catch {
      setApiUnavailable(true)
      serviceRef.current = null
      onApiStatus?.(false)
    }
  }, [apiLoaded, onApiStatus])

  useEffect(() => {
    if (apiUnavailable || !serviceRef.current || !input || input.length < minLength) {
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
      let request: google.maps.places.AutocompletionRequest | null = null
      try {
        request = buildRequest()
      } catch {
        setApiUnavailable(true)
        setLoading(false)
        setPredictions([])
        setOpen(false)
        onApiStatus?.(false)
        return
      }

      if (!request) {
        setLoading(false)
        return
      }

      try {
        serviceRef.current!.getPlacePredictions(request, (results, status) => {
          if (requestId !== requestIdRef.current) return
          setLoading(false)
          try {
            if (
              status === window.google.maps.places.PlacesServiceStatus.OK &&
              results
            ) {
              setPredictions(results)
              setOpen(true)
              setHighlightIndex(-1)
              setApiUnavailable(false)
              onApiStatus?.(true)
            } else {
              setPredictions([])
              setOpen(false)
              setHighlightIndex(-1)
              if (
                status === window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED ||
                status === window.google.maps.places.PlacesServiceStatus.INVALID_REQUEST
              ) {
                setApiUnavailable(true)
                onApiStatus?.(false)
              }
            }
          } catch {
            setApiUnavailable(true)
            setPredictions([])
            setOpen(false)
            onApiStatus?.(false)
          }
        })
      } catch {
        setApiUnavailable(true)
        setLoading(false)
        setPredictions([])
        setOpen(false)
        onApiStatus?.(false)
      }
    }, debounceMs)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [apiUnavailable, buildRequest, debounceMs, input, minLength, onApiStatus])

  const clearPredictions = useCallback(() => {
    setPredictions([])
    setOpen(false)
    setHighlightIndex(-1)
  }, [])

  return {
    predictions,
    open,
    setOpen,
    loading,
    apiUnavailable,
    highlightIndex,
    setHighlightIndex,
    clearPredictions,
    serviceReady: Boolean(serviceRef.current) && !apiUnavailable,
  }
}

export async function fetchPlaceDetailsSafe(
  placeId: string,
  fields: string[]
): Promise<google.maps.places.PlaceResult | null> {
  try {
    if (!window.google?.maps?.places) return null
    const mapDiv = document.createElement('div')
    const placesService = new window.google.maps.places.PlacesService(mapDiv)
    return await new Promise((resolve) => {
      try {
        placesService.getDetails({ placeId, fields }, (place, status) => {
          if (
            status === window.google.maps.places.PlacesServiceStatus.OK &&
            place
          ) {
            resolve(place)
          } else {
            resolve(null)
          }
        })
      } catch {
        resolve(null)
      }
    })
  } catch {
    return null
  }
}
