'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Clock } from 'lucide-react'
import {
  effectiveQuarterAuctionStart,
  msUntilQuarterAuctionStart,
} from '@/lib/quarter-auction/schedule'

interface AuctionStartCountdownProps {
  scheduledStartAt: string | null | undefined
  eventStartAt: string | null | undefined
  className?: string
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

export function AuctionStartCountdown({
  scheduledStartAt,
  eventStartAt,
  className,
}: AuctionStartCountdownProps) {
  const start = effectiveQuarterAuctionStart(scheduledStartAt, eventStartAt)
  const [remainingMs, setRemainingMs] = useState<number | null>(() =>
    msUntilQuarterAuctionStart(scheduledStartAt, eventStartAt)
  )

  useEffect(() => {
    if (!start) return
    const tick = () => {
      setRemainingMs(msUntilQuarterAuctionStart(scheduledStartAt, eventStartAt))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [scheduledStartAt, eventStartAt, start])

  if (!start || remainingMs === null || remainingMs <= 0) return null

  return (
    <div
      className={
        className ??
        'rounded-xl border border-harvest-200 bg-harvest-50 px-4 py-3 text-sm text-harvest-900'
      }
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-harvest-700" aria-hidden />
        <div>
          <p className="font-semibold">Auction starts at {format(start, 'MMM d · h:mm a')}</p>
          <p className="mt-0.5 text-harvest-800">
            Bidding and activation unlock in {formatCountdown(remainingMs)}.
          </p>
        </div>
      </div>
    </div>
  )
}

export function useAuctionCanStart(
  scheduledStartAt: string | null | undefined,
  eventStartAt: string | null | undefined
): boolean {
  const [canStart, setCanStart] = useState(() => {
    const ms = msUntilQuarterAuctionStart(scheduledStartAt, eventStartAt)
    return ms === null || ms <= 0
  })

  useEffect(() => {
    const tick = () => {
      const ms = msUntilQuarterAuctionStart(scheduledStartAt, eventStartAt)
      setCanStart(ms === null || ms <= 0)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [scheduledStartAt, eventStartAt])

  return canStart
}
