/**
 * Google Maps platform usage in Popup Hub:
 *
 * Browser (Maps JavaScript API via @vis.gl/react-google-maps):
 * - Map display, Advanced Markers, InfoWindows — `/discover`, coordinator wizard, event form
 * - Places Autocomplete widget — venue + address search (wizard, event form)
 * - PlacesService.getDetails — place detail lookup after autocomplete pick
 * - Geocoder (client) — forward/reverse geocode on map click and address blur
 *
 * Server (REST):
 * - Geocoding API `geocode/json` — `lib/venues/verify-venue-coordinates.ts`
 *
 * Enable in Google Cloud Console for the browser key:
 * 1. Maps JavaScript API
 * 2. Places API (legacy — required by Maps JS `places` library)
 * 3. Geocoding API
 *
 * HTTP referrer restrictions (browser key): `https://popuphub.ca/*`, `https://*.vercel.app/*`, `http://localhost:*`
 *
 * Optional server-only key: `GOOGLE_MAPS_SERVER_API_KEY` with Geocoding API only (no referrer restriction).
 */

/** Libraries passed to Maps JS APIProvider where maps + pins + autocomplete are used. */
export const GOOGLE_MAPS_JS_LIBRARIES = ['places', 'marker'] as const

export function getGoogleMapsBrowserApiKey(): string {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    ''
  )
}

export function getGoogleMapsServerApiKey(): string {
  return (
    process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    ''
  )
}
