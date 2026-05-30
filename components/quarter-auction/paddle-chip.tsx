'use client'

import { cn } from '@/lib/utils'
import type { PaddleChipTier } from '@/lib/quarter-auction/paddle-pool'

export type PaddleChipState = 'available' | 'taken' | 'owned' | 'selected'

const TIER_FACE: Record<PaddleChipTier, { face: string; text: string }> = {
  white: { face: 'bg-white', text: 'text-stone-900' },
  green: { face: 'bg-emerald-600', text: 'text-white' },
}

const TIER_RIM: Record<PaddleChipTier, string> = {
  white:
    'bg-[repeating-conic-gradient(from_0deg,#ffffff_0deg_14deg,#2563eb_14deg_28deg)]',
  green:
    'bg-[repeating-conic-gradient(from_0deg,#ffffff_0deg_14deg,#15803d_14deg_28deg)]',
}

interface PaddleChipProps {
  number: string
  tier: PaddleChipTier
  state: PaddleChipState
  onClick?: () => void
  disabled?: boolean
  size?: 'md' | 'lg' | 'xl'
  selectableOwned?: boolean
  spinning?: boolean
  /** Slow continuous rotation (wallet hero). */
  spinLoop?: boolean
  /** Non-interactive display (no button, no state badges). */
  presentation?: boolean
}

const SIZE_CLASSES = {
  md: { outer: 'h-11 w-11 p-[3px]', inner: 'text-[10px]' },
  lg: { outer: 'h-14 w-14 p-[3px]', inner: 'text-xs' },
  xl: { outer: 'h-28 w-28 p-1 sm:h-32 sm:w-32', inner: 'text-xl sm:text-2xl' },
} as const

export function PaddleChip({
  number,
  tier,
  state,
  onClick,
  disabled,
  size = 'md',
  selectableOwned = false,
  spinning = false,
  spinLoop = false,
  presentation = false,
}: PaddleChipProps) {
  const face = TIER_FACE[tier]
  const isSelected = state === 'selected'
  const isTaken = state === 'taken'
  const isOwned = state === 'owned'
  const interactive =
    !presentation &&
    (state === 'available' || state === 'selected' || (isOwned && selectableOwned))

  const sizeClass = SIZE_CLASSES[size]
  const label = `Paddle number ${number}`

  const chipBody = (
    <>
      <span
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full border border-stone-300/80 font-bold tabular-nums',
          sizeClass.inner,
          face.face,
          face.text
        )}
      >
        {number}
      </span>
      {!presentation && isTaken ? (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-stone-800 px-1 text-[8px] font-semibold uppercase tracking-wide text-white">
          taken
        </span>
      ) : null}
      {!presentation && isOwned ? (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded bg-forest px-1 text-[8px] font-semibold uppercase tracking-wide text-white">
          yours
        </span>
      ) : null}
    </>
  )

  const className = cn(
    'relative flex shrink-0 items-center justify-center rounded-full shadow-[0_3px_0_rgba(0,0,0,0.2)]',
    sizeClass.outer,
    TIER_RIM[tier],
    interactive && !disabled && 'hover:scale-105 active:scale-95 cursor-pointer',
    isSelected && 'ring-2 ring-harvest-500 ring-offset-2 scale-105',
    !presentation &&
      (isTaken || (isOwned && !selectableOwned)) &&
      'opacity-45 cursor-not-allowed grayscale-[0.35]',
    !presentation && disabled && 'opacity-60 cursor-not-allowed',
    spinning && 'animate-paddle-chip-spin',
    spinLoop && 'animate-paddle-chip-spin-loop'
  )

  if (presentation) {
    return (
      <div className={className} role="img" aria-label={label}>
        {chipBody}
      </div>
    )
  }

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
      className={className}
    >
      {chipBody}
    </button>
  )
}
