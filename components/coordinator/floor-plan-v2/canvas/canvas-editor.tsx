'use client'

import { cn } from '@/lib/utils'

export interface CanvasEditorProps {
  /** Pack vendor booths inside the active room merged_zone. */
  onAutoArrange: () => void
  canAutoArrange: boolean
  disabledReason?: string | null
  className?: string
}

/**
 * Canvas-level editor actions — auto-arrange booth packing inside
 * merged_zone polygons (Turf-validated shelf scan).
 */
export function CanvasEditor({
  onAutoArrange,
  canAutoArrange,
  disabledReason,
  className,
}: CanvasEditorProps) {
  const title = canAutoArrange
    ? 'Shelf-pack vendor booths inside merged zones with 5′ aisles (Turf-validated)'
    : (disabledReason ??
      'Draw at least one vendor booth in the active room first')

  return (
    <section
      className={cn('flex flex-col gap-1.5', className)}
      aria-label="Canvas editor"
    >
      <button
        type="button"
        onClick={onAutoArrange}
        disabled={!canAutoArrange}
        className={cn(
          'w-full rounded-md border px-3 py-2 text-left text-[0.6875rem] font-semibold transition-colors',
          canAutoArrange
            ? 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
            : 'cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400'
        )}
        title={title}
      >
        Auto-Arrange
      </button>
      <p className="text-[0.625rem] leading-snug text-stone-500">
        Clears vendor booth positions and packs them into the merged zone with
        5′ aisles. Booths that cannot fit stay unplaced.
      </p>
    </section>
  )
}
