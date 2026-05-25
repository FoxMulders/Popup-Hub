'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { VendorFeedPostCreator } from '@/components/market-feed/vendor-feed-post-creator'
import { FeedErrorBoundary } from '@/components/market-feed/feed-error-boundary'

interface ActiveMarket {
  eventId: string
  eventName: string
}

interface VendorMeetTheMakerPanelProps {
  vendorId: string
}

export function VendorMeetTheMakerPanel({ vendorId }: VendorMeetTheMakerPanelProps) {
  const [markets, setMarkets] = useState<ActiveMarket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/vendor/active-markets')
        if (!res.ok) {
          const json = (await res.json()) as { error?: string }
          if (!cancelled) setError(json.error ?? 'Could not load active markets')
          return
        }
        const json = (await res.json()) as { markets?: ActiveMarket[] }
        if (!cancelled) setMarkets(json.markets ?? [])
      } catch {
        if (!cancelled) setError('Network error loading active markets')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border bg-white px-4 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading live markets…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-white px-4 py-8 text-center text-sm text-destructive">
        {error}
      </div>
    )
  }

  if (markets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-white px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">No live markets right now</p>
        <p className="mt-1 text-sm text-muted-foreground">
          When a market you&apos;re approved for goes live, you can post maker spotlights here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {markets.map((market) => (
        <FeedErrorBoundary key={market.eventId} title="Could not load post creator">
          <VendorFeedPostCreator
            eventId={market.eventId}
            eventName={market.eventName}
            vendorId={vendorId}
          />
        </FeedErrorBoundary>
      ))}
    </div>
  )
}
