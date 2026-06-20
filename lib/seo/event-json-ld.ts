import { publicAppUrl } from '@/lib/url/public-app-url'

type EventJsonLdInput = {
  id: string
  name: string
  description?: string | null
  startAt?: string | null
  endAt?: string | null
  locationName?: string | null
  address?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  coverImageUrl?: string | null
  vendorCount?: number
  status?: string | null
  organizerName?: string | null
}

function eventStatusSchema(status?: string | null): string {
  if (status === 'cancelled') return 'https://schema.org/EventCancelled'
  return 'https://schema.org/EventScheduled'
}

export function buildEventJsonLd(event: EventJsonLdInput) {
  const url = publicAppUrl(`/events/${event.id}`)
  const image = event.coverImageUrl?.trim() || publicAppUrl('/icons/icon-512x512.png')

  const location: Record<string, unknown> = {
    '@type': 'Place',
    name: event.locationName ?? 'Market venue',
  }

  const addressParts: Record<string, string> = {}
  if (event.address?.trim()) {
    addressParts.streetAddress = event.address.trim()
  }
  if (event.city?.trim()) {
    addressParts.addressLocality = event.city.trim()
  }
  if (Object.keys(addressParts).length > 0) {
    addressParts['@type'] = 'PostalAddress'
    addressParts.addressCountry = 'CA'
    location.address = addressParts
  }

  if (
    event.latitude != null &&
    event.longitude != null &&
    Number.isFinite(event.latitude) &&
    Number.isFinite(event.longitude)
  ) {
    location.geo = {
      '@type': 'GeoCoordinates',
      latitude: event.latitude,
      longitude: event.longitude,
    }
  }

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    url,
    image,
    isAccessibleForFree: true,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: eventStatusSchema(event.status),
    location,
  }

  if (event.description?.trim()) {
    jsonLd.description = event.description.trim()
  }

  if (event.startAt) {
    jsonLd.startDate = event.startAt
  }

  if (event.endAt) {
    jsonLd.endDate = event.endAt
  }

  if (event.organizerName?.trim()) {
    jsonLd.organizer = {
      '@type': 'Person',
      name: event.organizerName.trim(),
    }
  }

  if (event.vendorCount != null && event.vendorCount > 0) {
    jsonLd.offers = {
      '@type': 'Offer',
      url,
      price: 0,
      priceCurrency: 'CAD',
      availability: 'https://schema.org/InStock',
      description: `${event.vendorCount} confirmed vendor${event.vendorCount === 1 ? '' : 's'}`,
    }
  }

  return jsonLd
}
