'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

const TOOLTIP_CLASS =
  'absolute z-50 bottom-full left-0 mb-2 h-auto w-[min(16rem,calc(100vw-2rem))] rounded border-2 border-black bg-black text-white text-xs p-2 shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] pointer-events-none whitespace-normal break-words leading-snug'

interface WizardFilterTooltipProps {
  label: string
  tooltip: string
  htmlFor: string
  children: React.ReactNode
  className?: string
}

export function WizardFilterTooltip({
  label,
  tooltip,
  htmlFor,
  children,
  className,
}: WizardFilterTooltipProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={cn('relative h-auto w-full min-w-0 space-y-1 self-start', className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      <label
        htmlFor={htmlFor}
        className="text-xs font-heading font-semibold uppercase tracking-wide text-muted-foreground cursor-help"
      >
        {label}
      </label>
      {hovered ? (
        <div className={TOOLTIP_CLASS} role="tooltip">
          {tooltip}
        </div>
      ) : null}
      {children}
    </div>
  )
}
