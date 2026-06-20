'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HubGuardLogo } from '@/components/brand/hubguard-logo'

const DISMISS_KEY = 'popup-hub:hubguard-checkin-prompt-dismissed'

interface VendorCheckinHubguardPromptProps {
  reviewHref: string
  organizerName: string | null
  eventName: string
  /** Hide when vendor already left a HubGuard review for this event month. */
  alreadyReviewed?: boolean
}

export function VendorCheckinHubguardPrompt({
  reviewHref,
  organizerName,
  eventName,
  alreadyReviewed = false,
}: VendorCheckinHubguardPromptProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (alreadyReviewed) return
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(DISMISS_KEY) === '1') return
    setVisible(true)
  }, [alreadyReviewed])

  if (!visible || alreadyReviewed) return null

  return (
    <section className="market-panel space-y-3 border border-sky-200/80 bg-sky-50/60 p-5">
      <div className="flex items-start gap-3">
        <HubGuardLogo variant="icon" size="sm" className="mt-0.5 shrink-0" />
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-foreground">Help vendors with HubGuard</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            You just checked in to <span className="font-medium text-foreground">{eventName}</span>.
            {organizerName ? (
              <>
                {' '}
                Take 90 seconds to review{' '}
                <span className="font-medium text-foreground">{organizerName}</span> on HubGuard so
                other vendors know what to expect before they pay booth fees.
              </>
            ) : (
              ' Take 90 seconds to leave a structured HubGuard review so other vendors know what to expect before they pay booth fees.'
            )}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href={reviewHref}>
              <Button size="sm" className="min-h-9">
                Leave HubGuard review
              </Button>
            </Link>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-9"
              onClick={() => {
                window.localStorage.setItem(DISMISS_KEY, '1')
                setVisible(false)
              }}
            >
              Not now
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
