'use client'

import { ArrowLeft } from 'lucide-react'
import { usePageBack } from '@/hooks/use-page-back'
import { cn } from '@/lib/utils'

interface NavBackButtonProps {
  className?: string
}

/** Compact back control for the stacked app nav row (beside portal tabs). */
export function NavBackButton({ className }: NavBackButtonProps) {
  const { canGoBack, goBack } = usePageBack()

  if (!canGoBack) return null

  return (
    <button
      type="button"
      onClick={goBack}
      className={cn(
        'app-tap-target inline-flex shrink-0 items-center gap-1 rounded-full border border-stone-200/80 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-stone-800 shadow-sm transition-colors sm:min-h-10 sm:px-3 sm:text-xs',
        'hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/35 focus-visible:ring-offset-2',
        className
      )}
    >
      <ArrowLeft className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
      Back
    </button>
  )
}
