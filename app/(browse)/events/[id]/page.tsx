import { createClient } from '@/lib/supabase/server'
import { PublicEventDetail } from '@/components/public/public-event-detail'
import { EventJsonLd } from '@/components/seo/event-json-ld'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { format } from 'date-fns'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: event } = await supabase
    .from('events')
    .select('name, description, location_name, cover_image_url, start_at')
    .eq('id', id)
    .in('status', ['published', 'active', 'completed'])
    .maybeSingle()

  if (!event) {
    return buildPublicMetadata({
      title: 'Market not found — Popup Hub',
      description: 'This market listing is unavailable or has been removed.',
      path: `/events/${id}`,
    })
  }

  const dateLabel = event.start_at
    ? format(new Date(event.start_at), 'EEE, MMM d, yyyy')
    : null
  const description =
    event.description?.trim() ||
    `Pop-up market at ${event.location_name}${dateLabel ? ` on ${dateLabel}` : ''}. Browse confirmed vendors and plan your visit.`

  return buildPublicMetadata({
    title: `${event.name} — Popup Hub`,
    description,
    path: `/events/${id}`,
    imageUrl: event.cover_image_url,
    type: 'article',
  })
}

export default async function PublicEventPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: event }, { count: vendorCount }] = await Promise.all([
    supabase
      .from('events')
      .select(
        'id, name, description, start_at, end_at, location_name, address, city, cover_image_url, status, coordinator:profiles!events_coordinator_id_fkey(full_name)'
      )
      .eq('id', id)
      .in('status', ['published', 'active', 'completed'])
      .maybeSingle(),
    supabase
      .from('booth_applications')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('status', 'approved'),
  ])

  return (
    <>
      {event ? <EventJsonLd event={event} vendorCount={vendorCount ?? 0} /> : null}
      <PublicEventDetail eventId={id} />
    </>
  )
}
