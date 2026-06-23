'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  DEFAULT_DISTANCE_RADIUS_KM,
  MARKET_RADIUS_STORAGE_KEY,
  type DistanceRadiusKm,
} from '@/lib/markets/distance-radius'
import {
  DEFAULT_LOCATION_LABEL,
  NEAR_YOU_LABEL,
  readStoredUserLocation,
  storeUserLocation,
} from '@/lib/markets/user-location'
import { DEFAULT_REGION, type LatLng } from '@/lib/shopper/geo'

export type UseMarketAreaFilterOptions = {
  defaultRadius?: DistanceRadiusKm
  storageKey?: string
}

function readStoredRadius(
  fallback: DistanceRadiusKm,
  storageKey: string
): DistanceRadiusKm {
  if (typeof sessionStorage === 'undefined') return fallback
  try {
    const raw = sessionStorage.getItem(storageKey)
    if (raw === 'null') return null
    if (raw != null) {
      const parsed = Number(raw)
      if (!Number.isNaN(parsed)) return parsed
    }
  } catch {
    /* ignore */
  }
  return fallback
}

function geolocationErrorMessage(code: number): string {
  if (code === 1) {
    return 'Location permission denied. Allow location in your browser settings or enter your home address.'
  }
  if (code === 2) {
    return 'Could not determine your position. Try entering your home address instead.'
  }
  if (code === 3) {
    return 'Location request timed out. Try again or enter your home address.'
  }
  return 'Could not read your location. Try entering your home address instead.'
}

export function useMarketAreaFilter(options: UseMarketAreaFilterOptions = {}) {
  const defaultRadius = options.defaultRadius ?? DEFAULT_DISTANCE_RADIUS_KM
  const storageKey = options.storageKey ?? MARKET_RADIUS_STORAGE_KEY

  const [origin, setOrigin] = useState<LatLng>(DEFAULT_REGION)
  const [radiusKm, setRadiusKmState] = useState<DistanceRadiusKm>(defaultRadius)
  const [locationLabel, setLocationLabel] = useState(DEFAULT_LOCATION_LABEL)
  const [locating, setLocating] = useState(false)
  const [showDeviceLocationPin, setShowDeviceLocationPin] = useState(false)

  useEffect(() => {
    setRadiusKmState(readStoredRadius(defaultRadius, storageKey))
    const stored = readStoredUserLocation()
    if (stored) {
      setOrigin({ lat: stored.lat, lng: stored.lng })
      setLocationLabel(stored.label ?? NEAR_YOU_LABEL)
      setShowDeviceLocationPin(stored.label === NEAR_YOU_LABEL)
    }
  }, [defaultRadius, storageKey])

  const setRadiusKm = useCallback(
    (km: DistanceRadiusKm) => {
      setRadiusKmState(km)
      try {
        sessionStorage.setItem(storageKey, km == null ? 'null' : String(km))
      } catch {
        /* ignore */
      }
    },
    [storageKey]
  )

  const setOriginFromPlace = useCallback((lat: number, lng: number, label: string) => {
    const next = { lat, lng }
    setOrigin(next)
    setLocationLabel(label)
    setShowDeviceLocationPin(false)
    storeUserLocation({ ...next, label })
  }, [])

  const requestMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Location is not available on this device. Enter your home address instead.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setOrigin(next)
        setLocationLabel(NEAR_YOU_LABEL)
        setShowDeviceLocationPin(true)
        storeUserLocation({ ...next, label: NEAR_YOU_LABEL })
        setLocating(false)
      },
      (err) => {
        setLocating(false)
        toast.error(geolocationErrorMessage(err.code))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }, [])

  return {
    origin,
    radiusKm,
    setRadiusKm,
    locationLabel,
    locating,
    showDeviceLocationPin,
    requestMyLocation,
    setOriginFromPlace,
  }
}
