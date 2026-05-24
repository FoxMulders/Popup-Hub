import type { LatLng } from '@/lib/shopper/geo'

export const LOCATION_STORAGE_KEY = 'popup-hub:last-location'
export const DEFAULT_LOCATION_LABEL = 'Local area'
export const NEAR_YOU_LABEL = 'Near you'

export type StoredUserLocation = LatLng & { label?: string }

export function readStoredUserLocation(): StoredUserLocation | null {
  if (typeof window === 'undefined') return null
  try {
    let stored = localStorage.getItem(LOCATION_STORAGE_KEY)
    if (!stored && typeof sessionStorage !== 'undefined') {
      stored = sessionStorage.getItem(LOCATION_STORAGE_KEY)
      if (stored) {
        localStorage.setItem(LOCATION_STORAGE_KEY, stored)
        sessionStorage.removeItem(LOCATION_STORAGE_KEY)
      }
    }
    if (!stored) return null
    const parsed = JSON.parse(stored) as StoredUserLocation
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function storeUserLocation(location: StoredUserLocation): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location))
  } catch {
    /* ignore quota / private mode */
  }
}

/** Prompt for browser location; resolves stored coords or null if denied/unavailable. */
export function requestUserLocation(): Promise<StoredUserLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location: StoredUserLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: NEAR_YOU_LABEL,
        }
        storeUserLocation(location)
        resolve(location)
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  })
}
