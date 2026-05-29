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
