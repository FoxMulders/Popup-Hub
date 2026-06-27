'use client'

import { useEffect, useState } from 'react'
import { isMobileDevice } from '@/lib/pwa/platform'

/** Client-only mobile detection for nav href resolution (SSR-safe default: desktop). */
export function useIsMobileNav(): boolean {
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    setMobile(isMobileDevice())
    const mq = window.matchMedia('(max-width: 768px)')
    const onChange = () => setMobile(isMobileDevice() || mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return mobile
}
