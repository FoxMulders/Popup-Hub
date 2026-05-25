'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, LogIn, MapPin, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { requestUserLocation } from '@/lib/markets/user-location'
import { PatronPaddleCard } from '@/components/market-passport/patron-paddle-card'
import { PassportScanner } from '@/components/market-passport/passport-scanner'

interface PassportProgress {
  scannedCount: number
  vendorsRequired: number
  bonusEligible: boolean
  scannedVendorIds: string[]
}

interface MarketPassportPanelProps {
  eventId: string
  eventStatus: string
  loginNext?: string
}

export function MarketPassportPanel({
  eventId,
  eventStatus,
  loginNext,
}: MarketPassportPanelProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)
  const [paddleNumber, setPaddleNumber] = useState<number | null>(null)
  const [progress, setProgress] = useState<PassportProgress>({
    scannedCount: 0,
    vendorsRequired: 5,
    bonusEligible: false,
    scannedVendorIds: [],
  })
  const [submitting, setSubmitting] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)

  const loginReturnPath = loginNext ?? `/events/${eventId}`

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    setUnauthorized(false)
    try {
      const res = await fetch(`/api/markets/${eventId}/check-in`)
      if (res.status === 401) {
        setUnauthorized(true)
        return
      }
      const json = (await res.json()) as {
        checkedIn?: boolean
        paddleNumber?: number | null
        progress?: PassportProgress
        error?: string
      }
      if (!res.ok) {
        setLoadError(json.error ?? 'Could not load passport status')
        return
      }
      setCheckedIn(!!json.checkedIn)
      setPaddleNumber(json.paddleNumber ?? null)
      if (json.progress) setProgress(json.progress)
    } catch {
      setLoadError('Network error — check your connection and retry')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleCheckIn() {
    if (submitting) return
    setSubmitting(true)
    try {
      const location = await requestUserLocation()
      if (!location) {
        toast.error('Location access is required to check in at the market.')
        return
      }

      const res = await fetch(`/api/markets/${eventId}/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: location.lat, lng: location.lng }),
      })
      const json = (await res.json()) as {
        error?: string
        paddleNumber?: number
        alreadyCheckedIn?: boolean
        progress?: PassportProgress
      }

      if (!res.ok) {
        toast.error(json.error ?? 'Could not check in')
        return
      }

      setCheckedIn(true)
      setPaddleNumber(json.paddleNumber ?? null)
      if (json.progress) setProgress(json.progress)
      toast.success(
        json.alreadyCheckedIn
          ? 'You are already checked in'
          : `Welcome! Your paddle number is ${json.paddleNumber}`
      )
    } catch {
      toast.error('Network error — try again')
    } finally {
      setSubmitting(false)
    }
  }

  if (eventStatus === 'completed') return null

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading paddle & passport…
        </CardContent>
      </Card>
    )
  }

  if (unauthorized) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Paddle & Passport</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Sign in to check in at the market, get your digital paddle number, and collect vendor
            stamps for a bonus.
          </p>
          <Link href={`/login?redirectTo=${encodeURIComponent(loginReturnPath)}`}>
            <Button size="sm" className="gap-1.5">
              <LogIn className="h-4 w-4" />
              Sign in to participate
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="space-y-3 py-8 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!checkedIn || paddleNumber == null) {
    return (
      <Card className="border-harvest-200 bg-harvest-50/40">
        <CardHeader>
          <CardTitle className="text-base">Paddle & Passport</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Check in when you arrive to receive a digital paddle number. Scan vendor QR codes around
            the market to fill your passport and unlock the visit bonus.
          </p>
          <Button
            type="button"
            className="gap-1.5"
            disabled={submitting || !['published', 'active'].includes(eventStatus)}
            onClick={() => void handleCheckIn()}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
            Check in at market
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <section className="space-y-3">
        <PatronPaddleCard
          paddleNumber={paddleNumber}
          scannedCount={progress.scannedCount}
          vendorsRequired={progress.vendorsRequired}
          bonusEligible={progress.bonusEligible}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full gap-1.5 border-harvest-200"
          onClick={() => setScannerOpen(true)}
        >
          <QrCode className="h-4 w-4" />
          Scan vendor passport QR
        </Button>
      </section>

      <PassportScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScanComplete={() => {
          void refresh()
        }}
      />
    </>
  )
}
