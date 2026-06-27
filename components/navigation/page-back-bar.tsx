'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { isPageBackExcluded, pageBackFallbackHref } from '@/lib/navigation/page-back'
import { cn } from '@/lib/utils'

interface PageBackBarProps {
  className?: string
}

export function PageBackBar({ className }: PageBackBarProps) {
  const pathname = usePathname() ?? ''
  const router = useRouter()

  if (isPageBackExcluded(pathname)) return null

  function handleBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(pageBackFallbackHref(pathname))
  }

  return (
    <div
      className={cn(
        'page-back-bar shrink-0 border-b border-stone-200/60 bg-cream/90 px-[var(--page-gutter,0.75rem)] py-1.5 backdrop-blur-sm',
        className
      )}
    >
      <button
        type="button"
        onClick={handleBack}
        className="app-tap-target inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-foreground transition-colors hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back
      </button>
    </div>
  )
}
