'use client'

import { Lightbulb } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FeatureRequestFabProps {
  onClick: () => void
  className?: string
}

export function FeatureRequestFab({ onClick, className }: FeatureRequestFabProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      className={cn(
        'fixed z-40 h-auto min-h-11 gap-2 rounded-full px-4 py-2.5 shadow-[var(--shadow-market-lift)]',
        'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 md:bottom-6 md:right-6',
        className
      )}
      aria-label="Suggest an improvement"
    >
      <Lightbulb className="size-4 shrink-0" aria-hidden />
      <span className="hidden text-sm font-semibold sm:inline">Suggest an Improvement</span>
      <span className="text-sm font-semibold sm:hidden">Suggest</span>
    </Button>
  )
}
