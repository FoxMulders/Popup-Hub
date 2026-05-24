import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { VendorQuarterAuction } from '@/components/quarter-auction/vendor-dashboard'
import { getOrCreateSettings } from '@/lib/quarter-auction/catalog'
import { ArrowLeft } from 'lucide-react'
import type { AuctionCatalogItem, QuarterAuctionSettings } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function VendorQuarterAuctionPage({ params }: Props) {
  const { id: eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, status, start_at')
    .eq('id', eventId)
    .single()

  if (!event) notFound()

  const service = await createServiceClient()
  const settings = await getOrCreateSettings(service, eventId)

  const [{ data: approval }, { data: items }] = await Promise.all([
    supabase
      .from('quarter_auction_vendor_approvals')
      .select('vendor_id')
      .eq('event_id', eventId)
      .eq('vendor_id', user.id)
      .maybeSingle(),
    supabase
      .from('auction_catalog_items')
      .select('*')
      .eq('event_id', eventId)
      .neq('status', 'cancelled')
      .order('queue_position', { ascending: true }),
  ])

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <Link href={`/vendor/events/${eventId}`}>
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back to event
        </Button>
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{event.name}</h1>
        <p className="text-muted-foreground">Quarter Auction — vendor dashboard</p>
      </div>
      <VendorQuarterAuction
        eventId={eventId}
        eventStartAt={event.start_at}
        vendorId={user.id}
        isApproved={!!approval}
        items={(items ?? []) as AuctionCatalogItem[]}
        settings={settings as QuarterAuctionSettings}
      />
    </div>
  )
}
