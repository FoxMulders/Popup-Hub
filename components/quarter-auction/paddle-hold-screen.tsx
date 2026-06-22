'use client'

import { PaddleChip } from '@/components/quarter-auction/paddle-chip'
import { paddleChipTier } from '@/lib/quarter-auction/paddle-pool'

interface PaddleHoldScreenProps {
  paddleNumbers: string[]
  itemTitle: string
}

/** High-visibility digital paddle display — "hold up your phone" */
export function PaddleHoldScreen({ paddleNumbers, itemTitle }: PaddleHoldScreenProps) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-b from-harvest-400 to-harvest-600 p-6 text-center"
      role="status"
      aria-live="polite"
      aria-label={`Hold up phone showing paddle numbers for ${itemTitle}`}
    >
      <p className="text-sm font-semibold uppercase tracking-widest text-harvest-800/80 mb-4">
        Hold up your phone!
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4 w-full max-w-sm">
        {paddleNumbers.map((num) => {
          const n = parseInt(num, 10)
          const tier = Number.isFinite(n) ? paddleChipTier(n) : 'white'
          return (
            <div key={num} className="flex flex-col items-center gap-2">
              <PaddleChip
                number={num}
                tier={tier}
                state="owned"
                size="xl"
                presentation
                spinLoop
              />
              <p className="font-mono text-lg font-bold text-harvest-900">#{num}</p>
            </div>
          )
        })}
      </div>
      <p className="mt-6 text-sm text-harvest-800/90 max-w-xs">{itemTitle}</p>
      <p className="mt-2 text-xs text-harvest-900/70">Screen locked until the winner is drawn</p>
    </div>
  )
}
