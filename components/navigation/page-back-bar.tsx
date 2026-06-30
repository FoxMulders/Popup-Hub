'use client'

import { ArrowLeft } from 'lucide-react'
import { usePageBack } from '@/hooks/use-page-back'
import { cn } from '@/lib/utils'

interface PageBackBarProps {
  className?: string
}

export function PageBackBar({ className }: PageBackBarProps) {
  const { canGoBack, goBack } = usePageBack()

  if (!canGoBack) return null

  return (
    <div
      className={cn(
        'page-back-bar shrink-0 border-b border-stone-200/60 bg-cream/90 px-[var(--page-gutter,0.75rem)] py-1.5 backdrop-blur-sm',
        'max-md:sticky max-md:top-[var(--app-nav-height,3.25rem)] max-md:z-40',
        'max-md:[.app-nav--stacked~&]:top-[var(--app-nav-height-stacked,6rem)]',
        className
      )}
    >
      <button
        type="button"
        onClick={goBack}
        className="app-tap-target inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-foreground transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back
      </button>
    </div>
  )
}
