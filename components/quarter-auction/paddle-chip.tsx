'use client'

import { cn } from '@/lib/utils'
import type { PaddleChipTier } from '@/lib/quarter-auction/paddle-pool'

export type PaddleChipState = 'available' | 'taken' | 'owned' | 'selected'

const TIER_STYLES: Record<
  PaddleChipTier,
  { rim: string; face: string; text: string; edge: string }
> = {
  white: {
    rim: 'bg-stone-100',
    face: 'bg-white',
    text: 'text-stone-900',
    edge: 'border-stone-400',
  },
  green: {
    rim: 'bg-emerald-800',
    face: 'bg-emerald-600',
    text: 'text-white',
    edge: 'border-emerald-900',
  },
}

interface PaddleChipProps {
  number: string
  tier: PaddleChipTier
  state: PaddleChipState
  onClick?: () => void
  disabled?: boolean
}

export function PaddleChip({ number, tier, state, onClick, disabled }: PaddleChipProps) {
  const styles = TIER_STYLES[tier]
  const interactive = state === 'available' || state === 'selected'
  const isSelected = state === 'selected'
  const isTaken = state === 'taken'
  const isOwned = state === 'owned'

  return (
    <button
      type="button"
      disabled={disabled || isTaken || isOwned || !interactive}
      onClick={onClick}
      aria-pressed={isSelected}
      aria-label={
        isTaken
          ? `Paddle ${number}, taken`
          : isOwned
            ? `Paddle ${number}, yours`
            : isSelected
              ? `Paddle ${number}, selected`
              : `Select paddle ${number}`
      }
      className={cn(
        'relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 shadow-[0_2px_0_rgba(0,0,0,0.25)] transition-transform',
        styles.edge,
        styles.rim,
        interactive && !disabled && 'hover:scale-105 active:scale-95 cursor-pointer',
        isSelected && 'ring-2 ring-harvest-500 ring-offset-2 scale-105',
        (isTaken || isOwned) && 'opacity-45 cursor-not-allowed grayscale-[0.35]',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums',
          styles.face,
          styles.text,
          styles.edge
        )}
      >
        {number}
      </span>
      {isTaken ? (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-stone-800 px-1 text-[8px] font-semibold uppercase tracking-wide text-white">
          taken
        </span>
      ) : null}
      {isOwned ? (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-forest px-1 text-[8px] font-semibold uppercase tracking-wide text-white">
          yours
        </span>
      ) : null}
    </button>
  )
}
