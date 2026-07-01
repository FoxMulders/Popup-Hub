'use client'

import { cn } from '@/lib/utils'
import { fomoTooltips, type FomoTooltipId } from './fomo-tooltips'

export interface LockedModuleOverlayProps {
  title: string
  description: string
  tooltipId: FomoTooltipId
  onUpgrade: () => void
  unlocking?: boolean
  className?: string
}

export function LockedModuleOverlay({
  title,
  description,
  tooltipId,
  onUpgrade,
  unlocking = false,
  className,
}: LockedModuleOverlayProps) {
  return (
    <div
      className={cn(
        'group absolute inset-0 z-10 flex cursor-not-allowed flex-col items-center justify-center bg-gray-50/40 p-6 text-center backdrop-blur-[6px]',
        unlocking && 'pointer-events-none opacity-0 transition-opacity duration-300',
        className
      )}
    >
      <div
        className="pointer-events-none absolute top-2 right-2 z-20 max-w-[220px] rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-left text-xs leading-snug text-gray-700 opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100"
        role="tooltip"
      >
        {fomoTooltips[tooltipId]}
      </div>

      <div className="pointer-events-auto max-w-md transform cursor-default rounded-xl border border-gray-100 bg-white p-6 shadow-lg transition-all duration-200 hover:scale-[1.01]">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>
        <button
          type="button"
          onClick={onUpgrade}
          disabled={unlocking}
          className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-[#FF6B35] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e85f2f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Switch to Native Market (Free)
        </button>
      </div>
    </div>
  )
}
