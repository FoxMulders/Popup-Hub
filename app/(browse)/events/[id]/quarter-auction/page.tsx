import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { PatronQuarterAuctionLive } from '@/components/quarter-auction/patron-live-view'
import { getOrCreateSettings } from '@/lib/quarter-auction/catalog'
import { ArrowLeft } from 'lucide-react'
import type {
  AuctionCatalogItem,
  EventPaddle,
  QuarterAuctionSettings,
  Wallet,
} from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PatronQuarterAuctionPage({ params }: Props) {
  const { id: eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/events/${eventId}/quarter-auction`)

  const { data: event } = await supabase
    .from('events')
    .select('id, name, status, start_at')
    .eq('id', eventId)
    .in('status', ['published', 'active', 'completed'])
    .single()

  if (!event) notFound()

  const service = await createServiceClient()
  const settings = await getOrCreateSettings(service, eventId)

  const [{ data: items }, { data: paddles }, { data: wallet }] = await Promise.all([
    supabase
      .from('auction_catalog_items')
      .select('*')
      .eq('event_id', eventId)
      .neq('status', 'cancelled')
      .order('queue_position', { ascending: true }),
    supabase
      .from('event_paddles')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: true }),
    supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  return (
    <div className="min-h-screen bg-sage-50/30">
      <div className="border-b bg-white px-4 py-3">
        <Link href={`/events/${eventId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />
            {event.name}
          </Button>
        </Link>
      </div>
      <PatronQuarterAuctionLive
        eventId={eventId}
        eventStartAt={event.start_at}
        userId={user.id}
        initialItems={(items ?? []) as AuctionCatalogItem[]}
        initialPaddles={(paddles ?? []) as EventPaddle[]}
        initialWallet={(wallet as Wallet | null) ?? null}
        settings={settings as QuarterAuctionSettings}
      />
    </div>
  )
}
