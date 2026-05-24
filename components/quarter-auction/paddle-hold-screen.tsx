'use client'

interface PaddleHoldScreenProps {
  paddleNumbers: string[]
  itemTitle: string
}

/** High-visibility digital paddle display — "hold up your phone" */
export function PaddleHoldScreen({ paddleNumbers, itemTitle }: PaddleHoldScreenProps) {
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-gradient-to-b from-amber-400 to-amber-600 p-6 text-center"
      role="status"
      aria-live="polite"
      aria-label={`Hold up phone showing paddle numbers for ${itemTitle}`}
    >
      <p className="text-sm font-semibold uppercase tracking-widest text-amber-950/80 mb-4">
        Hold up your phone!
      </p>
      <div className="space-y-4 w-full max-w-xs">
        {paddleNumbers.map((num) => (
          <div
            key={num}
            className="rounded-2xl border-4 border-white bg-white/95 py-8 shadow-2xl"
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Paddle</p>
            <p className="font-mono text-6xl font-black text-forest tabular-nums">#{num}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-amber-950/90 max-w-xs">{itemTitle}</p>
    </div>
  )
}
