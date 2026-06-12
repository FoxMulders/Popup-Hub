import type { VenuePresetDoorSegment, VenueFixedAsset } from '@/lib/booth-planner/venue-presets'
import type { OffFloorZone } from '@/lib/booth-planner/off-floor-zones'
import { distanceKm } from '@/lib/shopper/geo'

/** Edmonton capital-region quadrant for localized venue search. */
export type EdmontonVenueQuadrant = 'north' | 'south' | 'east' | 'west'

export const EDMONTON_QUADRANT_OPTIONS = [
  { id: 'all' as const, label: 'All Quadrants' },
  { id: 'north' as const, label: 'North Edmonton' },
  { id: 'south' as const, label: 'South Edmonton' },
  { id: 'east' as const, label: 'East Edmonton' },
  { id: 'west' as const, label: 'West Edmonton' },
]

export type EdmontonQuadrantFilter = (typeof EDMONTON_QUADRANT_OPTIONS)[number]['id']

export const EDMONTON_VENUE_IDS = [
  'kilkenny',
  'delwood',
  'strathcona',
  'ritchie',
  'beverly-heights',
  'fulton-place',
  'crestwood',
  'west-jasper-sherwood',
] as const

export type EdmontonVenueId = (typeof EDMONTON_VENUE_IDS)[number]

export interface EdmontonVenueBlueprint {
  id: EdmontonVenueId
  label: string
  quadrant: EdmontonVenueQuadrant
  address: string
  latitude: number
  longitude: number
  canvasWidth: number
  canvasHeight: number
  areaSqFt: number
  entrance: 'north' | 'south' | 'east' | 'west'
  fixedAssets: VenueFixedAsset[]
  doorSegments: VenuePresetDoorSegment[]
  /** Adjacent rooms drawn outside the hall shell (stage alcove, stairs, etc.). */
  offFloorZones?: OffFloorZone[]
}

/** Hardcoded Edmonton community-hall blueprints — dimensions + immutable anchors. */
export const EDMONTON_VENUE_BLUEPRINTS: EdmontonVenueBlueprint[] = [
  {
    id: 'kilkenny',
    label: 'Kilkenny Community League',
    quadrant: 'north',
    address: '14907 71 Street NW, Edmonton, AB',
    latitude: 53.5989,
    longitude: -113.4567,
    /** Main hall only — rectangular open floor; stage and kitchen are separate rooms off this space. */
    canvasWidth: 40,
    canvasHeight: 72,
    areaSqFt: 2_880,
    entrance: 'south',
    /** Main hall vendor floor only — stage alcove + stairs are off-floor beyond the north wall. */
    fixedAssets: [],
    offFloorZones: [
      {
        wall: 'north',
        col: 10,
        colSpan: 18,
        depthFt: 6,
        label: 'Raised Stage',
        kind: 'stage',
      },
      {
        wall: 'north',
        col: 28,
        colSpan: 4,
        widthFt: 3.5,
        depthFt: 6,
        label: 'Stage Stairs',
        kind: 'stairs',
      },
    ],
    doorSegments: [
      /** South — main double-door entrance (center). */
      { type: 'entrance', row: 0, col: 18, colSpan: 6, rowSpan: 1 },
      /** South-east corner emergency exit. */
      { type: 'exit', row: 0, col: 39, colSpan: 1, rowSpan: 4 },
      /** North — recessed stage proscenium opening (stage room behind the hall). */
      { type: 'exit', row: 71, col: 10, colSpan: 20, rowSpan: 1 },
      /** North — stage access doors flanking the proscenium. */
      { type: 'exit', row: 71, col: 8, colSpan: 2, rowSpan: 1 },
      { type: 'exit', row: 71, col: 30, colSpan: 2, rowSpan: 1 },
      /** West — side exit door. */
      { type: 'exit', row: 18, col: 0, colSpan: 1, rowSpan: 4 },
    ],
  },
  {
    id: 'delwood',
    label: 'Delwood Community League',
    quadrant: 'north',
    address: '11504 74 Street NW, Edmonton, AB',
    latitude: 53.5712,
    longitude: -113.4612,
    canvasWidth: 50,
    canvasHeight: 80,
    areaSqFt: 4_000,
    entrance: 'east',
    fixedAssets: [
      { type: 'Lock', x: 19, y: 1, w: 12, h: 15, label: 'Kitchen Hatch' },
    ],
    doorSegments: [
      { type: 'entrance', row: 34, col: 49, colSpan: 1, rowSpan: 12 },
      { type: 'exit', row: 34, col: 0, colSpan: 1, rowSpan: 8 },
    ],
  },
  {
    id: 'strathcona',
    label: 'Strathcona Community League',
    quadrant: 'south',
    address: '1011 87 Avenue NW, Edmonton, AB',
    latitude: 53.5189,
    longitude: -113.5123,
    canvasWidth: 45,
    canvasHeight: 60,
    areaSqFt: 2_700,
    entrance: 'south',
    fixedAssets: [
      { type: 'Lock', x: 1, y: 24, w: 6, h: 12, label: 'Fireplace Alcove' },
    ],
    doorSegments: [
      { type: 'entrance', row: 0, col: 18, colSpan: 9, rowSpan: 1 },
      { type: 'exit', row: 59, col: 22, colSpan: 1, rowSpan: 6 },
      /** Large south window band — walkable glazing strip along the south wall. */
      { type: 'aisle', row: 0, col: 8, colSpan: 29, rowSpan: 1 },
    ],
  },
  {
    id: 'ritchie',
    label: 'Ritchie Community Hall',
    quadrant: 'south',
    address: '7727 98 Street NW, Edmonton, AB',
    latitude: 53.5123,
    longitude: -113.4789,
    canvasWidth: 50,
    canvasHeight: 90,
    areaSqFt: 4_500,
    entrance: 'south',
    fixedAssets: [
      { type: 'Lock', x: 19, y: 65, w: 12, h: 24, label: 'Permanent Stage' },
      { type: 'Wall', x: 25, y: 20, w: 1, h: 50, label: 'Lounge Partition' },
    ],
    doorSegments: [
      { type: 'entrance', row: 0, col: 20, colSpan: 10, rowSpan: 1 },
      { type: 'exit', row: 45, col: 49, colSpan: 1, rowSpan: 6 },
    ],
  },
  {
    id: 'beverly-heights',
    label: 'Beverly Heights Community Hall',
    quadrant: 'east',
    address: '3910 118 Avenue NW, Edmonton, AB',
    latitude: 53.5711,
    longitude: -113.4012,
    canvasWidth: 40,
    canvasHeight: 80,
    areaSqFt: 3_200,
    entrance: 'south',
    fixedAssets: [
      { type: 'Lock', x: 15, y: 1, w: 10, h: 20, label: 'Main Stage' },
      { type: 'Lock', x: 1, y: 28, w: 8, h: 22, label: 'Side Bar Barricade' },
    ],
    doorSegments: [
      { type: 'entrance', row: 0, col: 16, colSpan: 8, rowSpan: 1 },
      { type: 'exit', row: 0, col: 39, colSpan: 1, rowSpan: 5 },
    ],
  },
  {
    id: 'fulton-place',
    label: 'Fulton Place Community League',
    quadrant: 'east',
    address: '6120 Fulton Road NW, Edmonton, AB',
    latitude: 53.5234,
    longitude: -113.4234,
    canvasWidth: 35,
    canvasHeight: 70,
    areaSqFt: 2_450,
    entrance: 'south',
    fixedAssets: [
      { type: 'Lock', x: 10, y: 32, w: 15, h: 8, label: 'Kitchen Counter' },
    ],
    doorSegments: [
      { type: 'entrance', row: 0, col: 14, colSpan: 7, rowSpan: 1 },
      { type: 'exit', row: 69, col: 11, colSpan: 13, rowSpan: 1 },
    ],
  },
  {
    id: 'crestwood',
    label: 'Crestwood Community Hall',
    quadrant: 'west',
    address: '14325 96 Avenue NW, Edmonton, AB',
    latitude: 53.5345,
    longitude: -113.5789,
    canvasWidth: 45,
    canvasHeight: 75,
    areaSqFt: 3_375,
    entrance: 'north',
    fixedAssets: [
      { type: 'Lock', x: 1, y: 55, w: 8, h: 15, label: 'Storage Bay' },
    ],
    doorSegments: [
      { type: 'entrance', row: 74, col: 17, colSpan: 11, rowSpan: 1 },
      { type: 'exit', row: 0, col: 22, colSpan: 1, rowSpan: 6 },
    ],
  },
  {
    id: 'west-jasper-sherwood',
    label: 'West Jasper Sherwood Hall',
    quadrant: 'west',
    address: '9020 156 Street NW, Edmonton, AB',
    latitude: 53.5456,
    longitude: -113.6012,
    canvasWidth: 50,
    canvasHeight: 85,
    areaSqFt: 4_250,
    entrance: 'south',
    fixedAssets: [
      { type: 'Lock', x: 1, y: 32, w: 12, h: 20, label: 'Raised Performance Platform' },
    ],
    doorSegments: [
      { type: 'entrance', row: 0, col: 20, colSpan: 10, rowSpan: 1 },
      { type: 'exit', row: 42, col: 49, colSpan: 1, rowSpan: 8 },
    ],
  },
]

export const EDMONTON_VENUE_BY_ID: Record<EdmontonVenueId, EdmontonVenueBlueprint> =
  Object.fromEntries(EDMONTON_VENUE_BLUEPRINTS.map((v) => [v.id, v])) as Record<
    EdmontonVenueId,
    EdmontonVenueBlueprint
  >

export function getEdmontonVenueById(id: string): EdmontonVenueBlueprint | undefined {
  return EDMONTON_VENUE_BY_ID[id as EdmontonVenueId]
}

export function isEdmontonVenueId(id: string | null | undefined): id is EdmontonVenueId {
  return id != null && id in EDMONTON_VENUE_BY_ID
}

/** Cascade filter: quadrant bucket + lowercase name substring match. */
export function filterEdmontonVenues(
  quadrant: EdmontonQuadrantFilter,
  searchText: string
): EdmontonVenueBlueprint[] {
  const query = searchText.trim().toLowerCase()
  return EDMONTON_VENUE_BLUEPRINTS.filter((venue) => {
    if (quadrant !== 'all' && venue.quadrant !== quadrant) return false
    if (query && !venue.label.toLowerCase().includes(query)) return false
    return true
  })
}

const VENUE_MATCH_NOISE =
  /\b(community league|community hall|hall|edmonton|ab|alberta|canada)\b/gi

function normalizeVenueMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(VENUE_MATCH_NOISE, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeStreetAddress(value: string): string {
  return value
    .toLowerCase()
    .replace(/,.*$/, '')
    .replace(/\b(nw|ne|sw|se|ab|alberta|canada)\b/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function venueNameMatchesBlueprint(venueName: string, venue: EdmontonVenueBlueprint): boolean {
  const normalizedName = normalizeVenueMatchText(venueName)
  if (!normalizedName) return false

  const normalizedLabel = normalizeVenueMatchText(venue.label)
  if (
    normalizedName === normalizedLabel ||
    normalizedName.includes(normalizedLabel) ||
    normalizedLabel.includes(normalizedName)
  ) {
    return true
  }

  const slug = venue.id.replace(/-/g, ' ')
  return normalizedName.includes(slug) || slug.includes(normalizedName)
}

function venueAddressMatchesBlueprint(address: string, venue: EdmontonVenueBlueprint): boolean {
  const normalizedAddress = normalizeStreetAddress(address)
  if (!normalizedAddress) return false
  const normalizedBlueprint = normalizeStreetAddress(venue.address)
  return (
    normalizedAddress === normalizedBlueprint ||
    normalizedAddress.includes(normalizedBlueprint) ||
    normalizedBlueprint.includes(normalizedAddress)
  )
}

/** Match a Places pick or saved venue to a known Edmonton hall template. */
export function matchEdmontonVenuePreset(params: {
  venueName?: string
  address?: string
  lat?: number
  lng?: number
}): EdmontonVenueId | null {
  const venueName = params.venueName?.trim() ?? ''
  const address = params.address?.trim() ?? ''
  const { lat, lng } = params

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    let closest: { id: EdmontonVenueId; distanceKm: number } | null = null
    for (const venue of EDMONTON_VENUE_BLUEPRINTS) {
      const distance = distanceKm(
        { lat: lat!, lng: lng! },
        { lat: venue.latitude, lng: venue.longitude }
      )
      if (distance <= 0.2 && (!closest || distance < closest.distanceKm)) {
        closest = { id: venue.id, distanceKm: distance }
      }
    }
    if (closest) return closest.id
  }

  if (address) {
    for (const venue of EDMONTON_VENUE_BLUEPRINTS) {
      if (venueAddressMatchesBlueprint(address, venue)) return venue.id
    }
  }

  if (venueName) {
    for (const venue of EDMONTON_VENUE_BLUEPRINTS) {
      if (venueNameMatchesBlueprint(venueName, venue)) return venue.id
    }
  }

  return null
}
