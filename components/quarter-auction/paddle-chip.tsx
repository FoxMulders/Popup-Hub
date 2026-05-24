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
  size?: 'md' | 'lg'
  selectableOwned?: boolean
}

export function PaddleChip({
  number,
  tier,
  state,
  onClick,
  disabled,
  size = 'md',
  selectableOwned = false,
}: PaddleChipProps) {
  const styles = TIER_STYLES[tier]
  const isSelected = state === 'selected'
  const isTaken = state === 'taken'
  const isOwned = state === 'owned'
  const interactive =
    state === 'available' || state === 'selected' || (isOwned && selectableOwned)

  const dim = size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'
  const inner = size === 'lg' ? 'h-10 w-10 text-xs' : 'h-8 w-8 text-[10px]'

  return (
    <button
      type="button"
      disabled={disabled || isTaken || (!selectableOwned && isOwned) || !interactive}
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
        'relative flex shrink-0 items-center justify-center rounded-full border-2 shadow-[0_2px_0_rgba(0,0,0,0.25)] transition-transform',
        dim,
        styles.edge,
        styles.rim,
        interactive && !disabled && 'hover:scale-105 active:scale-95 cursor-pointer',
        isSelected && 'ring-2 ring-harvest-500 ring-offset-2 scale-105',
        (isTaken || (isOwned && !selectableOwned)) &&
          'opacity-45 cursor-not-allowed grayscale-[0.35]',
        disabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full border font-bold tabular-nums',
          inner,
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
