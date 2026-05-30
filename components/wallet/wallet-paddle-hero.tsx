'use client'

import { PaddleChip } from '@/components/quarter-auction/paddle-chip'
import { paddleChipTier } from '@/lib/quarter-auction/paddle-pool'
import { formatPaddleIdDisplay } from '@/lib/wallet/paddle-id'

interface WalletPaddleHeroProps {
  paddleNumbers: string[]
  paddleId: string | null | undefined
}

function tierForNumber(num: string) {
  const n = parseInt(num, 10)
  return Number.isFinite(n) ? paddleChipTier(n) : 'white'
}

function uniquePaddleNumbers(numbers: string[]): string[] {
  const seen = new Set<string>()
  return numbers.filter((n) => {
    if (seen.has(n)) return false
    seen.add(n)
    return true
  })
}

export function WalletPaddleHero({ paddleNumbers, paddleId }: WalletPaddleHeroProps) {
  const unique = uniquePaddleNumbers(paddleNumbers)
  const primary = unique[0]
  const extra = unique.slice(1)

  return (
    <div className="mt-5 flex flex-col items-center text-center">
      {primary ? (
        <>
          <PaddleChip
            number={primary}
            tier={tierForNumber(primary)}
            state="owned"
            size="xl"
            presentation
            spinLoop
          />
          {extra.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {extra.map((num) => (
                <PaddleChip
                  key={num}
                  number={num}
                  tier={tierForNumber(num)}
                  state="owned"
                  size="lg"
                  presentation
                  spinLoop
                />
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div
          className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-dashed border-stone-300 bg-white/60 sm:h-32 sm:w-32"
          aria-hidden
        >
          <span className="px-4 text-center text-xs leading-snug text-muted-foreground">
            Buy paddle numbers at your quarter auction
          </span>
        </div>
      )}

      {paddleId ? (
        <p className="mt-3 max-w-full truncate font-mono text-[11px] text-muted-foreground">
          {formatPaddleIdDisplay(paddleId)}
        </p>
      ) : (
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          Add funds to receive your wallet paddle ID
        </p>
      )}
    </div>
  )
}
