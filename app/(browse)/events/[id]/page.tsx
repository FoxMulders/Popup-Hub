import { createClient } from '@/lib/supabase/server'
import { PublicEventDetail } from '@/components/public/public-event-detail'
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
  return <PublicEventDetail eventId={id} />
}
