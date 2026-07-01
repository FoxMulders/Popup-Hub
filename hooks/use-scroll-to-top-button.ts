'use client'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  getMaxScrollOffset,
  isScrollToTopDomSuppressed,
  routeSuppressesScrollToTopButton,
  SCROLL_TO_TOP_THRESHOLD_PX,
} from '@/lib/navigation/scroll-to-top'

export function useScrollToTopButton(): boolean {
  const pathname = usePathname() ?? ''
  const [visible, setVisible] = useState(false)

  const sync = useCallback(() => {
    if (routeSuppressesScrollToTopButton(pathname) || isScrollToTopDomSuppressed()) {
      setVisible(false)
      return
    }

    setVisible(getMaxScrollOffset() >= SCROLL_TO_TOP_THRESHOLD_PX)
  }, [pathname])

  useEffect(() => {
    sync()

    const onScroll = () => sync()
    const onResize = () => sync()

    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', onResize, { passive: true })

    const observer = new MutationObserver(() => sync())
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-layout-canvas'],
    })
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-layout-canvas', 'data-mobile-bottom-nav'],
    })

    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', onResize)
      observer.disconnect()
    }
  }, [sync])

  return visible
}
