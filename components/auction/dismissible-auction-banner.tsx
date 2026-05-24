'use client'

import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'

function storageKey(scope: string, id: string) {
  return `dismissed-auction:${scope}:${id}`
}

export function useDismissedAuction(scope: string, id: string) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey(scope, id)) === '1')
    } catch {
      setDismissed(false)
    }
  }, [scope, id])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(storageKey(scope, id), '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }, [scope, id])

  const restore = useCallback(() => {
    try {
      localStorage.removeItem(storageKey(scope, id))
    } catch {
      /* ignore */
    }
    setDismissed(false)
  }, [scope, id])

  return { dismissed, dismiss, restore }
}

interface DismissibleAuctionBannerProps {
  scope: string
  id: string
  children: React.ReactNode
}

export function DismissibleAuctionBanner({ scope, id, children }: DismissibleAuctionBannerProps) {
  const { dismissed, dismiss, restore } = useDismissedAuction(scope, id)

  if (dismissed) {
    return (
      <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-muted-foreground">
        Auction hidden for this event.{' '}
        <button type="button" className="font-medium text-forest underline" onClick={restore}>
          Show again
        </button>
      </div>
    )
  }

  return (
    <div className="relative mt-4">
      {children}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={dismiss}
        aria-label="Hide auction for this event"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
