/** Default map center: Edmonton, AB */
export const DEFAULT_REGION = { lat: 53.5461, lng: -113.4938 }

export interface LatLng {
  lat: number
  lng: number
}

/** Haversine distance in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

export function directionsUrl(lat: number, lng: number, address?: string): string {
  const destination = address?.trim()
    ? encodeURIComponent(address.trim())
    : encodeURIComponent(`${lat},${lng}`)
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`
}

export function openDirections(lat: number, lng: number, address?: string): void {
  window.location.href = directionsUrl(lat, lng, address)
}
