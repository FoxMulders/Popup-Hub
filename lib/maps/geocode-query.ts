const CANADIAN_POSTAL_CODE_RE = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/

export interface GeocodeResult {
  lat: number
  lng: number
  label: string
}

interface GeocodeApiResponse {
  results?: Array<{
    formatted_address?: string
    geometry?: { location?: { lat: number; lng: number } }
  }>
  status?: string
  error_message?: string
}

export function getGoogleMapsServerApiKey(): string | null {
  return (
    process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    null
  )
}

/** Uppercase and format Canadian postal codes; append country hint for geocoder. */
export function normalizeGeocodeQuery(query: string): string {
  const trimmed = query.trim()
  const compact = trimmed.replace(/\s|-/g, '')
  if (CANADIAN_POSTAL_CODE_RE.test(trimmed) || /^[A-Za-z]\d[A-Za-z]\d[A-Za-z]\d$/i.test(compact)) {
    const upper = compact.toUpperCase()
    return `${upper.slice(0, 3)} ${upper.slice(3)}, Canada`
  }
  return trimmed
}

export async function geocodeAddressQuery(query: string): Promise<GeocodeResult | null> {
  const apiKey = getGoogleMapsServerApiKey()
  if (!apiKey) return null

  const address = normalizeGeocodeQuery(query)
  const params = new URLSearchParams({
    address,
    components: 'country:CA',
    region: 'ca',
    key: apiKey,
  })

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`
  )
  const data = (await res.json()) as GeocodeApiResponse

  if (data.status !== 'OK' || !data.results?.length) {
    return null
  }

  const first = data.results[0]
  const lat = first.geometry?.location?.lat
  const lng = first.geometry?.location?.lng
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  return {
    lat,
    lng,
    label: first.formatted_address ?? address,
  }
}
