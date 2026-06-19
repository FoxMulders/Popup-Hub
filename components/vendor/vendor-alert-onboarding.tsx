'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MapPin, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'popup-hub:vendor-alert-onboarding-dismissed'

export function VendorAlertOnboarding() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.localStorage.getItem(DISMISS_KEY) === '1') return
    setVisible(true)
  }, [])

  if (!visible) return null

  return (
    <div className="mb-6 rounded-2xl border border-violet-200 bg-violet-50/80 p-4">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold text-violet-950">Get notified about new markets nearby</p>
          <p className="text-xs leading-relaxed text-violet-900/80">
            Set your home base and travel radius in Profile — we will alert you when organizers publish
            markets in your area.
          </p>
          <Link href="/profile">
            <Button size="sm" className="min-h-9">
              Set up market alerts
            </Button>
          </Link>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 px-2"
          aria-label="Dismiss"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, '1')
            setVisible(false)
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
