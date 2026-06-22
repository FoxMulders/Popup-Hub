'use client'

import { Loader2 } from 'lucide-react'

interface BiddingClosedOverlayProps {
  itemTitle: string
  /** Patron entered paddles for this round — show hold-up copy. */
  hasEntries: boolean
}

/** Full-screen lock when bidding closes — everyone waits for the draw. */
export function BiddingClosedOverlay({ itemTitle, hasEntries }: BiddingClosedOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-b from-stone-900/95 to-stone-800/95 p-6 text-center text-white"
      role="status"
      aria-live="polite"
      aria-label={`Bidding closed for ${itemTitle}`}
    >
      <Loader2 className="mb-4 h-10 w-10 animate-spin text-harvest-400" aria-hidden />
      <p className="text-sm font-semibold uppercase tracking-widest text-harvest-300/90">
        Bidding closed
      </p>
      <p className="mt-2 max-w-xs text-lg font-medium">
        {hasEntries
          ? 'Hold up your phone — drawing a winner from entered paddles…'
          : 'Drawing a winner from entered paddles…'}
      </p>
      <p className="mt-4 text-sm text-white/70">{itemTitle}</p>
    </div>
  )
}
