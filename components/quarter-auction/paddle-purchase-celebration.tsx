'use client'

import { useEffect } from 'react'
import { PaddleChip } from '@/components/quarter-auction/paddle-chip'
import { paddleChipTier } from '@/lib/quarter-auction/paddle-pool'

interface PaddlePurchaseCelebrationProps {
  paddleNumbers: string[]
  onDone: () => void
}

export function PaddlePurchaseCelebration({
  paddleNumbers,
  onDone,
}: PaddlePurchaseCelebrationProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 2400)
    return () => window.clearTimeout(timer)
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-black/50 p-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Paddle purchase confirmation"
      onClick={onDone}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onDone()
      }}
    >
      <p className="text-center text-lg font-semibold text-white drop-shadow">
        {paddleNumbers.length === 1 ? 'Your paddle is ready!' : 'Your paddles are ready!'}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        {paddleNumbers.map((num) => {
          const n = parseInt(num, 10)
          const tier = Number.isFinite(n) ? paddleChipTier(n) : 'white'
          return (
            <PaddleChip
              key={num}
              number={num}
              tier={tier}
              state="owned"
              size="lg"
              spinning
            />
          )
        })}
      </div>
      <p className="text-sm text-white/80">Tap anywhere to continue</p>
    </div>
  )
}
