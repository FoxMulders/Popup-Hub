export interface StaticMapOptions {
  lat: number
  lng: number
  width?: number
  height?: number
  zoom?: number
  /** Hex color without #, e.g. "22c55e" */
  markerColor?: string
}

const DEFAULT_WIDTH = 400
const DEFAULT_HEIGHT = 192
const DEFAULT_ZOOM = 14
const DEFAULT_MARKER_COLOR = '22c55e'

function getStaticMapApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  return key || null
}

export function buildStaticMapUrl({
  lat,
  lng,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  zoom = DEFAULT_ZOOM,
  markerColor = DEFAULT_MARKER_COLOR,
}: StaticMapOptions): string | null {
  const apiKey = getStaticMapApiKey()
  if (!apiKey) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const params = new URLSearchParams({
    center: `${lat},${lng}`,
    zoom: String(zoom),
    size: `${width}x${height}`,
    scale: '2',
    markers: `color:0x${markerColor}|${lat},${lng}`,
    key: apiKey,
  })

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}
