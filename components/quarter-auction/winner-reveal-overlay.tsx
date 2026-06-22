'use client'

import { PaddleChip } from '@/components/quarter-auction/paddle-chip'
import { paddleChipTier } from '@/lib/quarter-auction/paddle-pool'

interface WinnerRevealOverlayProps {
  paddleNumber: string
  itemTitle: string
  /** Patron owns the winning paddle — subtle cue only; full celebration is separate. */
  isWinner?: boolean
}

/** Room-wide winning paddle announcement — visible on every patron screen. */
export function WinnerRevealOverlay({
  paddleNumber,
  itemTitle,
  isWinner = false,
}: WinnerRevealOverlayProps) {
  const num = parseInt(paddleNumber, 10)
  const tier = Number.isFinite(num) ? paddleChipTier(num) : 'white'

  return (
    <div
      className="fixed inset-0 z-[45] flex flex-col items-center justify-center bg-gradient-to-b from-forest/95 to-emerald-900/95 p-6 text-center text-white"
      role="status"
      aria-live="assertive"
      aria-label={`Winning paddle number ${paddleNumber} for ${itemTitle}`}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-200/90">
        Winning paddle
      </p>
      <div className="mt-6 scale-150 sm:scale-[1.75]">
        <PaddleChip
          number={paddleNumber}
          tier={tier}
          state="available"
          size="xl"
          presentation
          spinLoop
        />
      </div>
      <p className="mt-10 font-mono text-5xl font-black tabular-nums sm:text-6xl">#{paddleNumber}</p>
      <p className="mt-3 max-w-sm text-base text-emerald-100/90">{itemTitle}</p>
      {isWinner ? (
        <p className="mt-4 text-lg font-bold text-harvest-300 animate-pulse">That&apos;s you!</p>
      ) : null}
    </div>
  )
}
