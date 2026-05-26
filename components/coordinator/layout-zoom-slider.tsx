'use client'

import { Minus, Plus, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'

export const LAYOUT_ZOOM_MIN = 0.25
export const LAYOUT_ZOOM_MAX = 2
export const LAYOUT_ZOOM_DEFAULT = 1
export const LAYOUT_ZOOM_STEP = 0.05

export interface LayoutZoomSliderProps {
  zoom: number
  onZoomChange: (zoom: number) => void
  className?: string
}

function clampZoom(value: number): number {
  return Math.min(LAYOUT_ZOOM_MAX, Math.max(LAYOUT_ZOOM_MIN, value))
}

export function LayoutZoomSlider({ zoom, onZoomChange, className }: LayoutZoomSliderProps) {
  const pct = Math.round(zoom * 100)

  function setFromPercent(nextPct: number) {
    onZoomChange(clampZoom(nextPct / 100))
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 shrink-0 rounded-lg border border-stone-200 bg-stone-50 px-2 py-1',
        className
      )}
      role="group"
      aria-label="Canvas zoom"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Zoom
      </span>
      <TooltipWrapper text="Zoom out">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onZoomChange(clampZoom(zoom - LAYOUT_ZOOM_STEP))}
          disabled={zoom <= LAYOUT_ZOOM_MIN + 0.001}
          aria-label="Zoom out"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
      </TooltipWrapper>
      <input
        id="layout-zoom-slider"
        type="range"
        min={Math.round(LAYOUT_ZOOM_MIN * 100)}
        max={Math.round(LAYOUT_ZOOM_MAX * 100)}
        step={Math.round(LAYOUT_ZOOM_STEP * 100)}
        value={pct}
        onChange={(event) => setFromPercent(Number(event.target.value))}
        // Native range inputs already support touch on iOS / Android.
        // `touch-manipulation` removes the 300 ms tap-delay legacy quirk
        // and a generous height + accent + thumb shadow makes the thumb
        // hit-target finger-friendly. The wider min-w guarantees the
        // track is long enough to be drag-able with a thumb on a phone.
        aria-label="Zoom level"
        aria-valuemin={Math.round(LAYOUT_ZOOM_MIN * 100)}
        aria-valuemax={Math.round(LAYOUT_ZOOM_MAX * 100)}
        aria-valuenow={pct}
        className="h-3 w-32 min-w-[8rem] cursor-pointer accent-forest touch-manipulation sm:w-36"
      />
      <TooltipWrapper text="Zoom in">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onZoomChange(clampZoom(zoom + LAYOUT_ZOOM_STEP))}
          disabled={zoom >= LAYOUT_ZOOM_MAX - 0.001}
          aria-label="Zoom in"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </TooltipWrapper>
      <span className="w-9 text-right text-[10px] font-medium tabular-nums text-muted-foreground">
        {pct}%
      </span>
      <TooltipWrapper text="Reset zoom to 100%">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onZoomChange(LAYOUT_ZOOM_DEFAULT)}
          disabled={Math.abs(zoom - LAYOUT_ZOOM_DEFAULT) < 0.001}
          aria-label="Reset zoom"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </TooltipWrapper>
    </div>
  )
}

/** Wrapper that scales canvas content while preserving scroll bounds. */
export function LayoutZoomViewport({
  zoom,
  width,
  height,
  children,
  className,
}: {
  zoom: number
  width: number
  height: number
  children: ReactNode
  className?: string
}) {
  const scaledWidth = width * zoom
  const scaledHeight = height * zoom

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{
        width: scaledWidth,
        height: scaledHeight,
        minWidth: scaledWidth,
        minHeight: scaledHeight,
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width,
          height,
          transform: `scale(${zoom})`,
        }}
      >
        {children}
      </div>
    </div>
  )
}
