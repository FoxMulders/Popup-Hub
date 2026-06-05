'use client'

import { useEffect, useState } from 'react'

/** Matches Tailwind `md` — mobile-first layouts stack below this width. */
export const MOBILE_VIEWPORT_MAX_PX = 767

export function useMobileViewport(breakpoint = MOBILE_VIEWPORT_MAX_PX): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [breakpoint])

  return isMobile
}
