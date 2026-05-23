'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_DISTANCE_RADIUS_KM,
  MARKET_RADIUS_STORAGE_KEY,
  type DistanceRadiusKm,
} from '@/lib/markets/distance-radius'
import { DEFAULT_REGION, type LatLng } from '@/lib/shopper/geo'

const LOCATION_STORAGE_KEY = 'popup-hub:last-location'

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
  const [locationLabel, setLocationLabel] = useState('Edmonton area')
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    setRadiusKmState(readStoredRadius())
    try {
      const stored = sessionStorage.getItem(LOCATION_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as LatLng & { label?: string }
        setOrigin({ lat: parsed.lat, lng: parsed.lng })
        if (parsed.label) setLocationLabel(parsed.label)
      }
    } catch {
      /* ignore */
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
        setLocationLabel('Near you')
        sessionStorage.setItem(
          LOCATION_STORAGE_KEY,
          JSON.stringify({ ...next, label: 'Near you' })
        )
        setLocating(false)
      },
      () => {
        setLocating(false)
      },
      { enableHighAccuracy: false, timeout: 10000 }
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
