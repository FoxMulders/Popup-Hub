'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createLoaderController,
  fetchLoaderAnimation,
} from '@/lib/brand/popup-loader-runtime'
import { POPUP_LOADER } from '@/lib/brand/popup-loader-config'

/**
 * Full-screen premium loader — Lottie animation with embedded Popup Hub logo.
 * Syncs window "load" with animation completion before fading out.
 */
export function PopupPageLoader() {
  const lottieHostRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
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

    const host = lottieHostRef.current
    if (!host) {
      body.style.overflow = previousOverflow
      body.classList.remove('loader-active')
      setVisible(false)
      return
    }

    let controller: ReturnType<typeof createLoaderController> | null = null
    let dismissed = false

    function cleanupDom() {
      controller?.destroy()
      controller = null
      body.style.overflow = previousOverflow || 'auto'
      body.classList.remove('loader-active')
      setVisible(false)
    }

    const dismiss = () => {
      if (dismissed) return
      dismissed = true
      setExiting(true)
      window.setTimeout(cleanupDom, POPUP_LOADER.fadeOutMs)
    }

    void fetchLoaderAnimation()
      .then((animationData) => {
        controller = createLoaderController({
          container: host,
          animationData,
          onReadyToDismiss: dismiss,
        })
      })
      .catch(() => {
        if (document.readyState === 'complete') {
          dismiss()
        } else {
          window.addEventListener('load', dismiss, { once: true })
        }
      })

    return () => {
      controller?.destroy()
      body.style.overflow = previousOverflow
      body.classList.remove('loader-active')
    }
  }, [])

  if (!visible) return null

  return (
    <div
      ref={screenRef}
      id="loader-screen"
      className={`loader-screen${exiting ? ' loader-screen--exit' : ''}`}
      aria-hidden={exiting}
      aria-busy={!exiting}
      role="status"
      aria-label="Loading Popup Hub"
    >
      <div ref={lottieHostRef} id="lottie-loader" className="loader-screen__lottie" />
    </div>
  )
}
