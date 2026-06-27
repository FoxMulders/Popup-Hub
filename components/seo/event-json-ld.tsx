import { JsonLdScript } from '@/components/seo/json-ld-script'
import { buildEventJsonLd } from '@/lib/seo/event-json-ld'

type EventJsonLdProps = {
  event: {
    id: string
    name: string
    description?: string | null
    start_at?: string | null
    end_at?: string | null
    location_name?: string | null
    address?: string | null
    city?: string | null
    latitude?: number | null
    longitude?: number | null
    cover_image_url?: string | null
    status?: string | null
    coordinator?: { id?: string; full_name?: string | null } | { id?: string; full_name?: string | null }[] | null
  }
  vendorCount?: number
  vendorNames?: string[]
  organizerId?: string | null
}

export function EventJsonLd({
  event,
  vendorCount,
  vendorNames,
  organizerId,
}: EventJsonLdProps) {
  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator

  const jsonLd = buildEventJsonLd({
    id: event.id,
    name: event.name,
    description: event.description,
    startAt: event.start_at,
    endAt: event.end_at,
    locationName: event.location_name,
    address: event.address,
    city: event.city,
    province: 'AB',
    latitude: event.latitude,
    longitude: event.longitude,
    coverImageUrl: event.cover_image_url,
    vendorCount,
    status: event.status,
    organizerName: coordinator?.full_name,
    organizerId: organizerId ?? coordinator?.id ?? null,
    vendorNames,
  })

  return <JsonLdScript data={jsonLd} />
}
