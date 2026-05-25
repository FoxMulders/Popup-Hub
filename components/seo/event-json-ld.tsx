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
    cover_image_url?: string | null
  }
  vendorCount?: number
}

export function EventJsonLd({ event, vendorCount }: EventJsonLdProps) {
  const jsonLd = buildEventJsonLd({
    id: event.id,
    name: event.name,
    description: event.description,
    startAt: event.start_at,
    endAt: event.end_at,
    locationName: event.location_name,
    address: event.address,
    coverImageUrl: event.cover_image_url,
    vendorCount,
  })

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
