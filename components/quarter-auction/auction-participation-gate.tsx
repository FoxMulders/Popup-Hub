'use client'

import { useCallback, useEffect, useState } from 'react'
import { MapPin, Loader2, CheckCircle2, LogIn } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/lib/toast'
import { requestUserLocation } from '@/lib/markets/user-location'
import { AUCTION_PRESENCE_RADIUS_METERS } from '@/lib/quarter-auction/participation'

interface AuctionParticipationGateProps {
  eventId: string
  loginNext?: string
  onParticipated?: () => void
  children?: React.ReactNode
}

export function AuctionParticipationGate({
  eventId,
  loginNext,
  onParticipated,
  children,
}: AuctionParticipationGateProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [participated, setParticipated] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loginReturnPath = loginNext ?? `/events/${eventId}/quarter-auction`

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/quarter-auction/${eventId}/participate`)
      if (res.status === 401) {
        setParticipated(false)
        window.location.href = `/login?redirectTo=${encodeURIComponent(loginReturnPath)}`
        return
      }
      const json = (await res.json()) as { participated?: boolean; error?: string }
      if (!res.ok) {
        setLoadError(json.error ?? 'Could not verify participation')
        return
      }
      setParticipated(!!json.participated)
      if (json.participated) onParticipated?.()
    } catch {
      setLoadError('Network error — check your connection and retry')
    } finally {
      setLoading(false)
    }
  }, [eventId, loginReturnPath, onParticipated])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleParticipate() {
    if (submitting) return
    setSubmitting(true)
    try {
      const location = await requestUserLocation()
      if (!location) {
        toast.error(
          'Location access is required, or visit the registration desk if you do not have a smartphone.'
        )
        return
      }

      const res = await fetch(`/api/quarter-auction/${eventId}/participate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: location.lat, lng: location.lng }),
      })
      const json = (await res.json()) as { error?: string; alreadyRegistered?: boolean }
      if (!res.ok) {
        toast.error(json.error ?? 'Could not confirm participation')
        return
      }

      setParticipated(true)
      onParticipated?.()
      toast.success(
        json.alreadyRegistered ? 'You are already participating' : 'You are in — good luck!'
      )
    } catch {
      toast.error('Network error — try again or visit the registration desk')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Checking participation…
        </CardContent>
      </Card>
    )
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button type="button" variant="outline" onClick={() => void refresh()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (participated) {
    return <>{children}</>
  }

  const next = loginReturnPath

  return (
    <Card className="border-harvest-200 bg-harvest-50/40">
      <CardHeader>
        <CardTitle className="text-lg">Join this auction</CardTitle>
        <p className="text-sm text-muted-foreground">
          Auctions are in-person only. Sign in, verify you are at the venue, then tap participate.
          No smartphone? Visit the registration desk — staff can set up your wallet and paddles for
          you.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <LogIn className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
            <span>You must be signed in (required to open this page).</span>
          </li>
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
            <span>
              You must be at the event venue (within about{' '}
              {AUCTION_PRESENCE_RADIUS_METERS} m of the map pin).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest" aria-hidden />
            <span>Tap participate below to enter the auction room.</span>
          </li>
        </ol>

        <Button
          className="w-full min-h-12 text-base gap-2"
          disabled={submitting}
          onClick={() => void handleParticipate()}
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <MapPin className="h-5 w-5" />
          )}
          Participate at this event
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Not signed in?{' '}
          <Link href={`/login?redirectTo=${encodeURIComponent(next)}`} className="text-forest underline">
            Log in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
