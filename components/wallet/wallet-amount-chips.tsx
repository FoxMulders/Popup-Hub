'use client'

import { cn } from '@/lib/utils'
import { formatCents } from '@/lib/square/client'

interface WalletAmountChipsProps {
  amounts: readonly number[]
  selectedCents: number
  onSelect: (cents: number) => void
  variant?: 'sage' | 'blue'
  className?: string
}

const VARIANT_SELECTED = {
  sage: 'border-sage-500 bg-sage-50 text-sage-800',
  blue: 'border-blue-500 bg-blue-50 text-blue-700',
} as const

/** Touch-friendly amount picker — 2×2 grid on phones, single row on wider screens. */
export function WalletAmountChips({
  amounts,
  selectedCents,
  onSelect,
  variant = 'sage',
  className,
}: WalletAmountChipsProps) {
  return (
    <div
      className={cn('grid grid-cols-2 gap-2 min-[400px]:grid-cols-4', className)}
      role="group"
      aria-label="Select amount"
    >
      {amounts.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => onSelect(amount)}
          className={cn(
            'min-h-11 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition touch-manipulation',
            selectedCents === amount
              ? VARIANT_SELECTED[variant]
              : 'border-stone-200 bg-card text-foreground hover:border-stone-300 active:scale-[0.98]'
          )}
        >
          {formatCents(amount)}
        </button>
      ))}
    </div>
  )
}
