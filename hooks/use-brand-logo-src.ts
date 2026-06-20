'use client'

import { useEffect, useState } from 'react'
import {
  brandLogoSrc,
  resolveBrandLogoDark,
} from '@/lib/brand/brand-logo-paths'

/** Theme-aware Popup Hub storefront icon path (light / dark). */
export function useBrandLogoSrc() {
  const [src, setSrc] = useState(() => brandLogoSrc('light'))

  useEffect(() => {
    const sync = () => {
      setSrc(brandLogoSrc(resolveBrandLogoDark() ? 'dark' : 'light'))
    }

    sync()

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', sync)

    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    return () => {
      media.removeEventListener('change', sync)
      observer.disconnect()
    }
  }, [])

  return src
}
