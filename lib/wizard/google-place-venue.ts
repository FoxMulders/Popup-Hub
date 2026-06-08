function pickAddressComponent(
  components: google.maps.GeocoderAddressComponent[],
  type: string
): string | null {
  const match = components.find((c) => c.types.includes(type))
  return match?.long_name ?? null
}

/** Whether Google place types indicate a named POI (not a bare street address). */
export function isNamedEstablishmentPlace(types: string[] | undefined): boolean {
  if (!types?.length) return false
  return (
    types.includes('establishment') ||
    types.includes('point_of_interest') ||
    types.includes('premise')
  )
}

/** First comma-separated segment of a formatted address (street / building line). */
export function parsePrimaryAddressLine(formattedAddress: string): string | null {
  const first = formattedAddress.split(',')[0]?.trim()
  return first || null
}

/**
 * Resolve a display address from a Places result — prefers `formatted_address`,
 * otherwise reconstructs from structured `address_components`.
 */
export function formatPlaceAddress(
  place: Pick<google.maps.places.PlaceResult, 'formatted_address' | 'address_components'>
): string {
  const formatted = place.formatted_address?.trim()
  if (formatted) return formatted

  const components = place.address_components
  if (!components?.length) return ''

  const parts: string[] = []
  const streetNumber = pickAddressComponent(components, 'street_number')
  const route = pickAddressComponent(components, 'route')
  const street = [streetNumber, route].filter(Boolean).join(' ')
  if (street) parts.push(street)

  const locality =
    pickAddressComponent(components, 'locality') ??
    pickAddressComponent(components, 'postal_town') ??
    pickAddressComponent(components, 'sublocality')
  if (locality) parts.push(locality)

  const adminArea = pickAddressComponent(components, 'administrative_area_level_1')
  if (adminArea) parts.push(adminArea)

  const postal = pickAddressComponent(components, 'postal_code')
  if (postal) parts.push(postal)

  const country = pickAddressComponent(components, 'country')
  if (country) parts.push(country)

  return parts.join(', ')
}

/** True when `place.name` is just the street line, not a business / venue label. */
export function isGenericStreetPlaceName(
  placeName: string,
  formattedAddress: string,
  isEstablishment: boolean
): boolean {
  if (isEstablishment) return false
  const trimmed = placeName.trim()
  if (!trimmed) return true
  const primaryLine = parsePrimaryAddressLine(formattedAddress)
  if (!primaryLine) return false
  return trimmed.toLowerCase() === primaryLine.toLowerCase()
}

/**
 * Venue name to apply when the user picks from the address autocomplete.
 * Returns null when the place name is missing or only a generic street string.
 */
export function resolveVenueNameFromAddressPick(params: {
  placeName: string
  formattedAddress: string
  isEstablishment: boolean
}): string | null {
  const trimmedName = params.placeName.trim()
  if (!trimmedName) return null
  if (
    isGenericStreetPlaceName(trimmedName, params.formattedAddress, params.isEstablishment)
  ) {
    return null
  }
  return trimmedName
}

/**
 * Decide the venue name to apply after a Places pick or geocode.
 * Returns null when the coordinator's existing name should be kept.
 */
export function resolveVenueNameForPlace(params: {
  placeName: string
  formattedAddress: string
  isEstablishment: boolean
  currentVenueName: string
}): string | null {
  const trimmedCurrent = params.currentVenueName.trim()
  const trimmedName = params.placeName.trim()

  if (trimmedName) {
    if (params.isEstablishment || !trimmedCurrent) {
      return trimmedName
    }
    return null
  }

  if (!trimmedCurrent) {
    return parsePrimaryAddressLine(params.formattedAddress)
  }

  return null
}

/** Venue name for a map pin drop — ignores any typed draft in the venue field. */
export function resolveVenueNameFromMapGeocode(
  result: google.maps.GeocoderResult
): string | null {
  return resolveVenueNameFromGeocoderResult(result, '')
}

export function resolveVenueNameFromGeocoderResult(
  result: google.maps.GeocoderResult,
  currentVenueName: string
): string | null {
  const formattedAddress = result.formatted_address ?? ''
  const isEstablishment = isNamedEstablishmentPlace(result.types)
  const placeName =
    result.address_components?.find((c) => c.types.includes('establishment'))?.long_name ??
    result.address_components?.find((c) => c.types.includes('point_of_interest'))?.long_name ??
    parsePrimaryAddressLine(formattedAddress) ??
    ''

  return resolveVenueNameForPlace({
    placeName,
    formattedAddress,
    isEstablishment,
    currentVenueName,
  })
}
