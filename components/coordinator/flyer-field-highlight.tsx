'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { FlyerFieldKey } from '@/lib/flyer/types'

interface FlyerFieldHighlightProps {
  fieldKey: FlyerFieldKey
  autoFilledFields: Set<FlyerFieldKey>
  children: ReactNode
  className?: string
}

export function FlyerFieldHighlight({
  fieldKey,
  autoFilledFields,
  children,
  className,
}: FlyerFieldHighlightProps) {
  const highlighted = autoFilledFields.has(fieldKey)

  return (
    <div
      className={cn(
        'space-y-1 rounded-lg transition-[box-shadow,background-color] duration-500',
        highlighted && 'bg-sage-50/80 p-2 -mx-2 ring-2 ring-sage-400/70',
        className
      )}
    >
      {highlighted ? (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sage-700">
          ✨ Auto-filled by AI
        </p>
      ) : null}
      {children}
    </div>
  )
}
