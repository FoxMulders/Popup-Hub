'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, Loader2, MoonStar, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DiscoveredVendorsSection } from '@/components/market-night/discovered-vendors-section'
import { BackedItemsSection } from '@/components/market-night/backed-items-section'
import { useMyNightSummary } from '@/hooks/use-my-night-summary'
import type { MyNightSummary } from '@/lib/market-night/summary'

interface MyNightAtAuctionProps {
  eventId: string
  initialSummary: MyNightSummary
}

export function MyNightAtAuction({ eventId, initialSummary }: MyNightAtAuctionProps) {
  const { summary, loading, error, refresh } = useMyNightSummary(eventId, initialSummary)
  const data = summary ?? initialSummary

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-16">
      <div>
        <Link href={`/events/${eventId}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to market
          </Button>
        </Link>

        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-harvest-100 text-harvest-700">
            <MoonStar className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground">
              My Night at the Auction
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{data.eventName}</p>
            {data.eventEndAt ? (
              <p className="text-xs text-muted-foreground">
                Wrapped up {format(new Date(data.eventEndAt), 'EEEE, MMMM d, yyyy')}
              </p>
            ) : null}
          </div>
        </div>

        {(data.checkedInAt || data.paddleNumber != null) && (
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
            {data.paddleNumber != null ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1">
                <Ticket className="h-3.5 w-3.5 text-harvest-600" />
                Paddle #{data.paddleNumber}
              </span>
            ) : null}
            {data.checkedInAt ? (
              <span>
                Checked in {format(new Date(data.checkedInAt), 'h:mm a')}
              </span>
            ) : null}
          </div>
        )}
      </div>

      {loading && !summary ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your recap…
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-white p-8 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="vendors" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vendors">
              Vendors You Discovered ({data.discoveredVendors.length})
            </TabsTrigger>
            <TabsTrigger value="items">
              Items You Backed ({data.backedItems.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vendors" className="mt-4">
            <DiscoveredVendorsSection vendors={data.discoveredVendors} eventId={eventId} />
          </TabsContent>

          <TabsContent value="items" className="mt-4">
            <BackedItemsSection items={data.backedItems} eventId={eventId} />
          </TabsContent>
        </Tabs>
      )}

      {!loading && !error && data.discoveredVendors.length === 0 && data.backedItems.length === 0 ? (
        <div className="rounded-2xl border bg-harvest-50/50 px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Your recap is ready — explore tabs above as you add passport scans and auction entries
            at future markets.
          </p>
        </div>
      ) : null}
    </div>
  )
}
