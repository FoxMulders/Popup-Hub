'use client'

import { useEffect } from 'react'

/**
 * Lock document scroll while the layout canvas is active; the canvas
 * scroll container is the single viewport for pan/zoom.
 */
export function useLayoutCanvasViewportLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    const html = document.documentElement
    const body = document.body
    html.setAttribute('data-layout-canvas', 'true')
    body.setAttribute('data-layout-canvas', 'true')
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.removeAttribute('data-layout-canvas')
      body.removeAttribute('data-layout-canvas')
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
    }
  }, [active])
}
