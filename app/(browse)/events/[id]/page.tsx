import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { PublicEventDetail } from '@/components/public/public-event-detail'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: event } = await supabase
    .from('events')
    .select('name, description, location_name')
    .eq('id', id)
    .in('status', ['published', 'active', 'completed'])
    .maybeSingle()

  if (!event) {
    return { title: 'Market not found — Popup Hub' }
  }

  return {
    title: `${event.name} — Popup Hub`,
    description: event.description ?? `Pop-up market at ${event.location_name}`,
  }
}

export default async function PublicEventPage({ params }: Props) {
  const { id } = await params
  return <PublicEventDetail eventId={id} />
}
