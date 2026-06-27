'use client'

import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { isPageBackExcluded, pageBackFallbackHref } from '@/lib/navigation/page-back'
import { cn } from '@/lib/utils'

interface NavBackButtonProps {
  className?: string
}

/** Compact back control for the stacked app nav row (beside portal tabs). */
export function NavBackButton({ className }: NavBackButtonProps) {
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
    <button
      type="button"
      onClick={handleBack}
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
