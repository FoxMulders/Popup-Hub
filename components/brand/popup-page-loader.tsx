'use client'

import { useCallback, useEffect, useState } from 'react'
import { POPUP_LOADER } from '@/lib/brand/popup-loader-config'
import { PopupPremiumLoaderScene } from '@/components/brand/popup-premium-loader-scene'

/**
 * Full-screen premium loader — articulated walk cycle, Popup Hub storefront,
 * and perspective door entry. Holds at the door until the page finishes loading.
 */
export function PopupPageLoader() {
  const [visible, setVisible] = useState(true)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      setVisible(false)
      return
    }

    const body = document.body
    const previousOverflow = body.style.overflow
    body.classList.add('loader-active')
    body.style.overflow = 'hidden'

    return () => {
      body.style.overflow = previousOverflow
      body.classList.remove('loader-active')
    }
  }, [])

  const dismiss = useCallback(() => {
    setExiting(true)
    window.setTimeout(() => {
      document.body.style.overflow = 'auto'
      document.body.classList.remove('loader-active')
      setVisible(false)
    }, POPUP_LOADER.fadeOutMs)
  }, [])

  if (!visible) return null

  return (
    <div
      id="loader-screen"
      className={`loader-screen${exiting ? ' loader-screen--exit' : ''}`}
      aria-hidden={exiting}
      aria-busy={!exiting}
      role="status"
      aria-label="Loading Popup Hub"
    >
      <PopupPremiumLoaderScene onReadyToDismiss={dismiss} />
    </div>
  )
}
