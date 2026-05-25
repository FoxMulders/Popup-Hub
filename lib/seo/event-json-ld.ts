import { publicAppUrl } from '@/lib/url/public-app-url'

type EventJsonLdInput = {
  id: string
  name: string
  description?: string | null
  startAt?: string | null
  endAt?: string | null
  locationName?: string | null
  address?: string | null
  coverImageUrl?: string | null
  vendorCount?: number
}

export function buildEventJsonLd(event: EventJsonLdInput) {
  const url = publicAppUrl(`/events/${event.id}`)
  const image = event.coverImageUrl?.trim() || publicAppUrl('/icons/icon-512x512.png')

  const location: Record<string, unknown> = {
    '@type': 'Place',
    name: event.locationName ?? 'Market venue',
  }

  if (event.address?.trim()) {
    location.address = {
      '@type': 'PostalAddress',
      streetAddress: event.address,
    }
  }

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    url,
    image,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
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

  if (event.vendorCount != null && event.vendorCount > 0) {
    jsonLd.offers = {
      '@type': 'Offer',
      url,
      availability: 'https://schema.org/InStock',
      description: `${event.vendorCount} confirmed vendor${event.vendorCount === 1 ? '' : 's'}`,
    }
  }

  return jsonLd
}
