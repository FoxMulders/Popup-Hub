'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, LogIn, Radio } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FeedErrorBoundary } from '@/components/market-feed/feed-error-boundary'
import { MeetTheMakerFeed } from '@/components/market-feed/meet-the-maker-feed'

interface MeetTheMakerSectionProps {
  eventId: string
  eventStatus: string
  loginNext?: string
}

export function MeetTheMakerSection({
  eventId,
  eventStatus,
  loginNext,
}: MeetTheMakerSectionProps) {
  const [loading, setLoading] = useState(true)
  const [checkedIn, setCheckedIn] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loginReturnPath = loginNext ?? `/events/${eventId}`

  const refreshAccess = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setUnauthorized(false)
    try {
      const res = await fetch(`/api/markets/${eventId}/check-in`)
      if (res.status === 401) {
        setUnauthorized(true)
        setCheckedIn(false)
        return
      }
      const json = (await res.json()) as { checkedIn?: boolean; error?: string }
      if (!res.ok) {
        setLoadError(json.error ?? 'Could not verify check-in')
        return
      }
      setCheckedIn(!!json.checkedIn)
    } catch {
      setLoadError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void refreshAccess()
  }, [refreshAccess])

  if (eventStatus !== 'active') return null

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Radio className="h-5 w-5 text-rose-500 animate-pulse" aria-hidden />
        <h2 className="font-heading text-lg font-semibold">Meet the Maker — Live</h2>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Verifying market check-in…
          </CardContent>
        </Card>
      ) : unauthorized ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Live maker feed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in and check in at the market to see vendor spotlights and join the conversation.
            </p>
            <Link href={`/login?redirectTo=${encodeURIComponent(loginReturnPath)}`}>
              <Button size="sm" className="gap-1.5">
                <LogIn className="h-4 w-4" />
                Sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : loadError ? (
        <Card>
          <CardContent className="space-y-3 py-8 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void refreshAccess()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : !checkedIn ? (
        <Card className="border-harvest-200 bg-harvest-50/30">
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Check in with Paddle & Passport above to unlock the live maker feed for this market.
            </p>
          </CardContent>
        </Card>
      ) : (
        <FeedErrorBoundary title="Meet the Maker feed hit a snag">
          <MeetTheMakerFeed eventId={eventId} />
        </FeedErrorBoundary>
      )}
    </section>
  )
}
