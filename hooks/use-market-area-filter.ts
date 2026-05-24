'use client'

import { useCallback, useEffect, useState } from 'react'
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

function readStoredRadius(): number | null {
  if (typeof sessionStorage === 'undefined') return DEFAULT_DISTANCE_RADIUS_KM
  try {
    const raw = sessionStorage.getItem(MARKET_RADIUS_STORAGE_KEY)
    if (raw === 'null') return null
    if (raw != null) {
      const parsed = Number(raw)
      if (!Number.isNaN(parsed)) return parsed
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_DISTANCE_RADIUS_KM
}

export function useMarketAreaFilter() {
  const [origin, setOrigin] = useState<LatLng>(DEFAULT_REGION)
  const [radiusKm, setRadiusKmState] = useState<number | null>(DEFAULT_DISTANCE_RADIUS_KM)
  const [locationLabel, setLocationLabel] = useState(DEFAULT_LOCATION_LABEL)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    setRadiusKmState(readStoredRadius())
    const stored = readStoredUserLocation()
    if (stored) {
      setOrigin({ lat: stored.lat, lng: stored.lng })
      setLocationLabel(stored.label ?? NEAR_YOU_LABEL)
    }
  }, [])

  const setRadiusKm = useCallback((km: DistanceRadiusKm) => {
    setRadiusKmState(km)
    try {
      sessionStorage.setItem(MARKET_RADIUS_STORAGE_KEY, km == null ? 'null' : String(km))
    } catch {
      /* ignore */
    }
  }, [])

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setOrigin(next)
        setLocationLabel(NEAR_YOU_LABEL)
        storeUserLocation({ ...next, label: NEAR_YOU_LABEL })
        setLocating(false)
      },
      () => {
        setLocating(false)
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
    useMyLocation,
  }
}
