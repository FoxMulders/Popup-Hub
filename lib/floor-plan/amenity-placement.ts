import type {
  AmenityType,
  PlacedObject,
} from '@/components/coordinator/floor-plan-v2/state/types'

export const AMENITY_FOOTPRINTS_FT: Record<
  AmenityType,
  { width: number; height: number; label: string }
> = {
  bouncy_castle: { width: 20, height: 20, label: 'Bouncy castle' },
  lost_and_found: { width: 8, height: 4, label: 'Lost & found' },
  seating: { width: 12, height: 8, label: 'Picnic seating' },
  restroom: { width: 8, height: 6, label: 'Hand wash / restroom' },
}

export const AMENITY_LABEL_PREFIX = 'AMENITY@'

export function defaultAmenityFootprintFt(type: AmenityType): {
  width: number
  height: number
} {
  const spec = AMENITY_FOOTPRINTS_FT[type]
  return { width: spec.width, height: spec.height }
}

export function defaultAmenityLabel(type: AmenityType): string {
  return AMENITY_FOOTPRINTS_FT[type].label
}

export function nextAmenityLabel(
  objects: ReadonlyArray<PlacedObject>,
  type: AmenityType
): string {
  const base = defaultAmenityLabel(type)
  const count = objects.filter(
    (o) => o.kind === 'amenity' && o.amenityType === type
  ).length
  return count === 0 ? base : `${base} ${count + 1}`
}

export function buildAmenityLegacyLabel(
  type: AmenityType,
  label: string | undefined
): string {
  return `${AMENITY_LABEL_PREFIX}${type}:${label ?? ''}`
}

export function parseAmenityLegacyLabel(raw: string): {
  amenityType: AmenityType
  label: string | undefined
} | null {
  if (!raw.startsWith(AMENITY_LABEL_PREFIX)) return null
  const remainder = raw.slice(AMENITY_LABEL_PREFIX.length)
  const colonIdx = remainder.indexOf(':')
  if (colonIdx < 0) return null
  const typePart = remainder.slice(0, colonIdx) as AmenityType
  if (!(typePart in AMENITY_FOOTPRINTS_FT)) return null
  const labelPart = remainder.slice(colonIdx + 1)
  return {
    amenityType: typePart,
    label: labelPart.length > 0 ? labelPart : undefined,
  }
}

/** Legacy venue element type for amenity round-trip. */
export function legacyVenueTypeForAmenity(type: AmenityType): 'info_desk' | 'seating' | 'restroom' | 'custom_label' {
  switch (type) {
    case 'lost_and_found':
      return 'info_desk'
    case 'seating':
      return 'seating'
    case 'restroom':
      return 'restroom'
    default:
      return 'custom_label'
  }
}
