import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { MarketDayShell } from '@/components/coordinator/market-day-shell'
import { CoordinatorQuarterAuction } from '@/components/quarter-auction/coordinator-dashboard'
import { AuctionList } from '@/components/auction/auction-control-panel'
import { buttonVariants } from '@/components/ui/button'
import { getOrCreateSettings } from '@/lib/quarter-auction/catalog'
import { Gavel } from 'lucide-react'
import type { Auction, AuctionCatalogItem, QuarterAuctionSettings } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function CoordinatorEventAuctionsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, coordinator_id, status, start_at')
    .eq('id', id)
    .eq('coordinator_id', user.id)
    .single()

  if (!event) notFound()
  if (event.status === 'cancelled') {
    redirect(`/coordinator/events/${id}`)
  }

  const service = await createServiceClient()
  const settings = await getOrCreateSettings(service, id)

  const [{ data: catalogItems }, { data: auctions }] = await Promise.all([
    supabase
      .from('auction_catalog_items')
      .select('*')
      .eq('event_id', id)
      .order('queue_position', { ascending: true }),
    supabase
      .from('auctions')
      .select('*, drops:auction_drops(*)')
      .eq('event_id', id)
      .order('created_at', { ascending: false }),
  ])

  return (
    <MarketDayShell eventId={id} eventName={event.name} activeSection="auctions">
      <div className="space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sage-600">
            Charity Quarter Auction
          </p>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Catalog, vendor approvals &amp; live control
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Approve vendors, reorder the catalog, set entry costs, and run the draw from the active
            bidder pool.
          </p>
        </div>

        <CoordinatorQuarterAuction
          eventId={id}
          eventStartAt={event.start_at}
          initialItems={(catalogItems ?? []) as AuctionCatalogItem[]}
          initialSettings={settings as QuarterAuctionSettings}
        />

        <div className="border-t pt-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">Legacy timer auctions</h3>
              <p className="text-sm text-muted-foreground">Drop-quarters timer mode (optional)</p>
            </div>
            <Link
              href={`/coordinator/auctions/new?eventId=${id}`}
              className={buttonVariants({ size: 'sm', variant: 'outline' }) + ' gap-1.5'}
            >
              <Gavel className="h-4 w-4" />
              Create timer auction
            </Link>
          </div>
          <AuctionList
            auctions={(auctions ?? []) as Auction[]}
            eventId={id}
            eventStartAt={event.start_at}
          />
        </div>
      </div>
    </MarketDayShell>
  )
}
