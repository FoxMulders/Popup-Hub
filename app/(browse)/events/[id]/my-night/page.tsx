import { notFound, redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { excludeTestMarkets } from '@/lib/queries/public-market-catalog'
import { MyNightAtAuction } from '@/components/market-night/my-night-at-auction'
import { getMyNightSummary } from '@/lib/market-night/summary'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: event } = await excludeTestMarkets(
    supabase.from('events').select('name').eq('id', id).eq('status', 'completed')
  ).maybeSingle()

  return buildPublicMetadata({
    title: event
      ? `My Night at the Auction — ${event.name}`
      : 'My Night at the Auction — Popup Hub',
    description: 'Your personal recap of vendors discovered and auction items backed at this market.',
    path: `/events/${id}/my-night`,
  })
}

export default async function MyNightPage({ params }: Props) {
  const { id: eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(`/events/${eventId}/my-night`)}`)
  }

  const service = await createServiceClient()
  const summary = await getMyNightSummary(service, eventId, user.id)

  if (!summary) {
    notFound()
  }

  return <MyNightAtAuction eventId={eventId} initialSummary={summary} />
}
