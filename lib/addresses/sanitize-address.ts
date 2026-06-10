import {
  coerceParsedAddress,
  formatParsedAddress,
  hasParsedAddressSignal,
  type ParsedAddressComponents,
} from '@/lib/addresses/parsed-address'

const PROVINCE_ABBREVS: Record<string, string> = {
  alberta: 'AB',
  'british columbia': 'BC',
  manitoba: 'MB',
  'new brunswick': 'NB',
  'newfoundland and labrador': 'NL',
  'northwest territories': 'NT',
  'nova scotia': 'NS',
  nunavut: 'NU',
  ontario: 'ON',
  'prince edward island': 'PE',
  quebec: 'QC',
  saskatchewan: 'SK',
  yukon: 'YT',
}

const POSTAL_CODE_RE = /\b([A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d)\b/

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeCanadianPostalCode(value: string): string {
  const match = value.match(POSTAL_CODE_RE)
  if (!match) return value
  const compact = match[1]!.replace(/\s|-/g, '').toUpperCase()
  const formatted = `${compact.slice(0, 3)} ${compact.slice(3)}`
  return value.replace(match[0], formatted)
}

function normalizeProvinceTokens(value: string): string {
  return value.replace(
    /\b(Alberta|British Columbia|Manitoba|New Brunswick|Newfoundland and Labrador|Northwest Territories|Nova Scotia|Nunavut|Ontario|Prince Edward Island|Quebec|Saskatchewan|Yukon)\b/gi,
    (token) => PROVINCE_ABBREVS[token.toLowerCase()] ?? token
  )
}

function stripNoise(value: string): string {
  return value
    .replace(/[#]+/g, ' ')
    .replace(/\b(unit|suite|ste|apt|apartment|bldg|building)\s*[#.]?\s*[\w-]+\b/gi, ' ')
    .replace(/\s*,\s*,+/g, ', ')
    .replace(/^\s*,\s*/g, '')
    .replace(/\s*,\s*$/g, '')
}

/**
 * Heuristic single-line parser for Canadian-style addresses when AI is unavailable.
 * Produces Google Geocoder-friendly output: street, city, province postal, country.
 */
export function parseAddressHeuristic(raw: string): ParsedAddressComponents {
  const cleaned = normalizeWhitespace(
    normalizeCanadianPostalCode(normalizeProvinceTokens(stripNoise(raw)))
  )
  if (!cleaned) return coerceParsedAddress(null)

  const parts = cleaned.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length === 0) return coerceParsedAddress(null)

  const country =
    parts[parts.length - 1]?.toLowerCase() === 'canada' ||
    parts[parts.length - 1]?.toLowerCase() === 'ca'
      ? 'Canada'
      : parts[parts.length - 1]?.length === 2
        ? ''
        : parts.length > 3
          ? parts[parts.length - 1]!
          : 'Canada'

  const withoutCountry =
    country === 'Canada' && parts[parts.length - 1]?.toLowerCase().match(/^(canada|ca)$/)
      ? parts.slice(0, -1)
      : parts

  const postalMatch = withoutCountry.join(' ').match(POSTAL_CODE_RE)
  const postal_code = postalMatch
    ? postalMatch[1]!.replace(/\s|-/g, '').toUpperCase().replace(/^(.{3})(.{3})$/, '$1 $2')
    : ''

  let locality = ''
  let administrative_area_level_1 = ''
  let streetParts: string[] = []

  if (withoutCountry.length >= 3) {
    streetParts = [withoutCountry[0]!]
    locality = withoutCountry[withoutCountry.length - 2] ?? ''
    const regionPart = withoutCountry[withoutCountry.length - 1] ?? ''
    const regionTokens = regionPart.replace(POSTAL_CODE_RE, '').trim().split(/\s+/)
    administrative_area_level_1 = regionTokens[0] ?? ''
  } else if (withoutCountry.length === 2) {
    streetParts = [withoutCountry[0]!]
    const cityRegion = withoutCountry[1]!.replace(POSTAL_CODE_RE, '').trim()
    const tokens = cityRegion.split(/\s+/)
    if (tokens.length >= 2 && /^[A-Z]{2}$/.test(tokens[tokens.length - 1]!)) {
      administrative_area_level_1 = tokens.pop()!
      locality = tokens.join(' ')
    } else {
      locality = cityRegion
    }
  } else {
    streetParts = [withoutCountry[0]!]
  }

  const streetLine = streetParts.join(' ')
  const streetMatch = streetLine.match(/^(\d+\S*)\s+(.+)$/)
  const street_number = streetMatch?.[1] ?? ''
  const route = streetMatch?.[2] ?? streetLine

  return {
    street_number,
    route,
    locality,
    administrative_area_level_1,
    postal_code,
    country: country || 'Canada',
  }
}

export interface SanitizedAddressResult {
  raw: string
  cleaned: string
  components: ParsedAddressComponents
  formatted: string
  usedHeuristic: boolean
}

/**
 * Sanitize a raw address string into a structured, geocoder-ready single line.
 * Uses fast heuristics first; callers may still run AI normalization afterward.
 */
export function sanitizeAddressForGeocoding(raw: string): SanitizedAddressResult | null {
  const trimmed = raw.trim()
  if (trimmed.length < 5) return null

  const cleaned = normalizeWhitespace(
    normalizeCanadianPostalCode(normalizeProvinceTokens(stripNoise(trimmed)))
  )
  const components = parseAddressHeuristic(cleaned)
  const formatted = hasParsedAddressSignal(components)
    ? formatParsedAddress(components)
    : cleaned

  return {
    raw: trimmed,
    cleaned,
    components,
    formatted: formatted || cleaned,
    usedHeuristic: hasParsedAddressSignal(components),
  }
}
