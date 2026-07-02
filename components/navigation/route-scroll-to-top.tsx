'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { resetScrollToTop } from '@/lib/navigation/scroll-to-top'

/**
 * Scrolls to top on pathname changes (Next.js App Router does not restore
 * window scroll the way Pages Router did). Query-string updates on the same
 * path are left alone so in-place filters and reloads keep scroll position.
 */
export function RouteScrollToTop() {
  const pathname = usePathname()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    resetScrollToTop()
  }, [pathname])

  return null
}
