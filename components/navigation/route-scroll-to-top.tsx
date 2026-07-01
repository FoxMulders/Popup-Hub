'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { resetScrollToTop } from '@/lib/navigation/scroll-to-top'

/**
 * Scrolls to top on client-side pathname changes (Next.js App Router does not
 * restore window scroll the way Pages Router did).
 *
 * Query-only updates (view toggles, filters, etc.) intentionally do not reset
 * scroll — those navigations use `router.replace(..., { scroll: false })` or
 * `window.history.replaceState` so the user keeps their place on the page.
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
