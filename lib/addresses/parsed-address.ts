export interface ParsedAddressComponents {
  street_number: string
  route: string
  locality: string
  administrative_area_level_1: string
  postal_code: string
  country: string
}

const EMPTY_PARSED: ParsedAddressComponents = {
  street_number: '',
  route: '',
  locality: '',
  administrative_area_level_1: '',
  postal_code: '',
  country: '',
}

/** Normalize AI / manual JSON into the expected address component shape. */
export function coerceParsedAddress(raw: unknown): ParsedAddressComponents {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_PARSED }

  const record = raw as Record<string, unknown>
  const pick = (key: keyof ParsedAddressComponents) => {
    const value = record[key]
    return typeof value === 'string' ? value.trim() : ''
  }

  return {
    street_number: pick('street_number'),
    route: pick('route'),
    locality: pick('locality'),
    administrative_area_level_1: pick('administrative_area_level_1'),
    postal_code: pick('postal_code'),
    country: pick('country'),
  }
}

/**
 * Format parsed components into a geocoder-friendly single line:
 * `[Street Number] [Route], [City], [Province/State] [Postal Code]`
 */
export function formatParsedAddress(components: ParsedAddressComponents): string {
  const street = [components.street_number, components.route].filter(Boolean).join(' ')
  const regionPostal = [components.administrative_area_level_1, components.postal_code]
    .filter(Boolean)
    .join(' ')
  const cityLine = [components.locality, regionPostal].filter(Boolean).join(', ')
  const parts = [street, cityLine].filter(Boolean)

  if (parts.length === 0) return ''
  if (components.country && !parts.join(' ').toLowerCase().includes(components.country.toLowerCase())) {
    return `${parts.join(', ')}, ${components.country}`
  }
  return parts.join(', ')
}

export function hasParsedAddressSignal(components: ParsedAddressComponents): boolean {
  return Boolean(
    components.route ||
      components.locality ||
      components.administrative_area_level_1 ||
      components.postal_code
  )
}
